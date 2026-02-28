"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Studio,
  Course,
  CourseLesson,
  TeacherStudent,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Studio management (teacher-only)
// ---------------------------------------------------------------------------

/**
 * Get the authenticated teacher's studio.
 * Returns null if user is not authenticated or is not a teacher.
 */
export async function getStudio(): Promise<Studio | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: studio } = await supabase
    .from("studios")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  return studio || null;
}

/**
 * Update teacher's studio name.
 */
export async function updateStudio(name: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  const { error } = await supabase
    .from("studios")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("owner_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Student management
// ---------------------------------------------------------------------------

interface AddStudentResult {
  success?: boolean;
  studentId?: string;
  studentCode?: string;
  error?: string;
}

/**
 * Create a new student account within the teacher's studio.
 *
 * Uses the admin API to:
 * 1. Create a Supabase Auth user (with email confirmation skipped)
 * 2. The database trigger auto-creates the profile with role='child'
 * 3. Link selected instruments to the student
 * 4. Create the teacher_students relationship
 * 5. Generate and return a unique student code
 */
export async function addStudent(
  displayName: string,
  pin: string,
  instrumentIds: string[],
  courseId: string | null = null,
  startDate: string = new Date().toISOString().split("T")[0],
  targetEndDate: string | null = null
): Promise<AddStudentResult> {
  try {
    // 1. Verify the caller is an authenticated teacher
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Niet ingelogd." };
    }

    const { data: teacherProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!teacherProfile || teacherProfile.role !== "teacher") {
      return { error: "Alleen docenten kunnen leerlingen toevoegen." };
    }

    // 2. Verify PIN format
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return { error: "PIN moet precies 4 cijfers zijn." };
    }

    // 3. Get teacher's studio
    const { data: studio } = await supabase
      .from("studios")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!studio) {
      return { error: "Studio niet gevonden." };
    }

    // 4. Create the student's Supabase Auth user via admin API
    const admin = createAdminClient();
    const studentEmail = `student-${crypto.randomUUID().slice(0, 8)}@practicehero.local`;

    const { data: newUser, error: createError } =
      await admin.auth.admin.createUser({
        email: studentEmail,
        password: pin,
        email_confirm: true, // Skip email verification for students
        user_metadata: {
          role: "child",
          display_name: displayName,
          studio_id: studio.id,
        },
      });

    if (createError) {
      return { error: createError.message };
    }

    if (!newUser.user) {
      return { error: "Kan leerling niet aanmaken." };
    }

    // 5. Link instruments to the new student
    if (instrumentIds.length > 0) {
      const instrumentLinks = instrumentIds.map((instrumentId, index) => ({
        child_id: newUser.user.id,
        instrument_id: instrumentId,
        is_primary: index === 0,
      }));

      const { error: instrumentError } = await admin
        .from("child_instruments")
        .insert(instrumentLinks);

      if (instrumentError) {
        console.error("Instrument linking error:", instrumentError);
        // Continue anyway - the student is created, just no instruments linked
      }
    }

    // 6. Generate unique student code via RPC
    const { data: studentCode, error: codeError } = await admin.rpc(
      "generate_student_code",
      {
        p_studio_id: studio.id,
      }
    );

    if (codeError || !studentCode) {
      return { error: "Kan leerlingcode niet genereren." };
    }

    // 7. Create teacher_students relationship
    const { error: linkError } = await admin
      .from("teacher_students")
      .insert({
        studio_id: studio.id,
        student_id: newUser.user.id,
        course_id: courseId || null,
        student_code: studentCode,
        current_level: 1,
        current_lesson: 1,
        start_date: startDate,
        target_end_date: targetEndDate || null,
        is_active: true,
      });

    if (linkError) {
      return { error: linkError.message };
    }

    return {
      success: true,
      studentId: newUser.user.id,
      studentCode: studentCode,
    };
  } catch (err) {
    console.error("addStudent error:", err);
    return { error: "Kan leerling niet aanmaken." };
  }
}

/**
 * Get all students for the authenticated teacher's studio.
 */
export async function getStudents(): Promise<TeacherStudent[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Get teacher's studio first
  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!studio) return [];

  // Get all students in this studio
  const { data: students } = await supabase
    .from("teacher_students")
    .select("*")
    .eq("studio_id", studio.id)
    .order("created_at", { ascending: false });

  return students || [];
}

/**
 * Get details for a specific student (with practice data).
 */
export async function getStudentDetail(
  studentId: string
): Promise<{
  student?: TeacherStudent & {
    name: string;
    streak_count?: number;
    total_points?: number;
    total_credits?: number;
  };
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Verify teacher owns this student
  const { data: student } = await supabase
    .from("teacher_students")
    .select("*")
    .eq("student_id", studentId)
    .single();

  if (!student) {
    return { error: "Leerling niet gevonden." };
  }

  // Verify this teacher owns the studio
  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("id", student.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Get student's profile for name
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", studentId)
    .single();

  // Get student's streak
  const { data: streak } = await supabase
    .from("streaks")
    .select("current_count")
    .eq("child_id", studentId)
    .single();

  // Get student's total points
  const { data: points } = await supabase
    .from("points")
    .select("amount")
    .eq("child_id", studentId);

  // Get student's total credits
  const { data: credits } = await supabase
    .from("super_credits")
    .select("amount")
    .eq("child_id", studentId);

  const totalPoints = points?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalCredits = credits?.reduce((sum, c) => sum + c.amount, 0) || 0;

  return {
    student: {
      ...student,
      name: profile?.display_name || "Onbekend",
      streak_count: streak?.current_count || 0,
      total_points: totalPoints,
      total_credits: totalCredits,
    },
  };
}

/**
 * Update a student's current level and lesson progress.
 */
export async function updateStudentProgress(
  studentId: string,
  level: number,
  lesson: number
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Verify teacher owns this student
  const { data: student } = await supabase
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", studentId)
    .single();

  if (!student) {
    return { error: "Leerling niet gevonden." };
  }

  // Verify teacher owns the studio
  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("id", student.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Update progress
  const { error } = await supabase
    .from("teacher_students")
    .update({
      current_level: level,
      current_lesson: lesson,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Deactivate a student (end the relationship).
 */
export async function deactivateStudent(studentId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Verify teacher owns this student
  const { data: student } = await supabase
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", studentId)
    .single();

  if (!student) {
    return { error: "Leerling niet gevonden." };
  }

  // Verify teacher owns the studio
  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("id", student.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Deactivate
  const { error } = await supabase
    .from("teacher_students")
    .update({ is_active: false })
    .eq("student_id", studentId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Course management
// ---------------------------------------------------------------------------

/**
 * Create a new course for the teacher's studio.
 */
export async function createCourse(
  name: string,
  instrumentId: string,
  totalLessons: number = 10,
  totalLevels: number = 10,
  description: string | null = null
): Promise<{ courseId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Get teacher's studio
  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Studio niet gevonden." };
  }

  // Create course
  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      studio_id: studio.id,
      instrument_id: instrumentId,
      name,
      description,
      total_lessons: totalLessons,
      total_levels: totalLevels,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { courseId: course.id };
}

/**
 * Get all courses for the teacher's studio.
 */
export async function getCourses(): Promise<Course[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Get teacher's studio
  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!studio) return [];

  // Get courses
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("studio_id", studio.id)
    .order("created_at", { ascending: false });

  return courses || [];
}

/**
 * Get a specific course with its lessons.
 */
export async function getCourseDetail(courseId: string): Promise<{
  course?: Course & { lessons: CourseLesson[] };
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Get course
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) {
    return { error: "Cursus niet gevonden." };
  }

  // Verify teacher owns this course
  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("id", course.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Get lessons
  const { data: lessons } = await supabase
    .from("course_lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("lesson_number")
    .order("level_number");

  return {
    course: {
      ...course,
      lessons: lessons || [],
    },
  };
}

/**
 * Save a course lesson (create or update).
 */
export async function saveCourseLesson(
  courseId: string,
  lessonNumber: number,
  levelNumber: number,
  title: string,
  description: string | null = null,
  videoUrl: string | null = null,
  audioUrl: string | null = null
): Promise<{ lessonId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Verify teacher owns this course
  const { data: course } = await supabase
    .from("courses")
    .select("studio_id")
    .eq("id", courseId)
    .single();

  if (!course) {
    return { error: "Cursus niet gevonden." };
  }

  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("id", course.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Upsert lesson
  const { data: lesson, error } = await supabase
    .from("course_lessons")
    .upsert(
      {
        course_id: courseId,
        lesson_number: lessonNumber,
        level_number: levelNumber,
        title,
        description,
        video_url: videoUrl,
        audio_url: audioUrl,
      },
      {
        onConflict: "course_id,lesson_number,level_number",
      }
    )
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { lessonId: lesson.id };
}

/**
 * Delete a course lesson.
 */
export async function deleteCourseLesson(lessonId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Get lesson + verify ownership
  const { data: lesson } = await supabase
    .from("course_lessons")
    .select("course_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) {
    return { error: "Les niet gevonden." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("studio_id")
    .eq("id", lesson.course_id)
    .single();

  if (!course) {
    return { error: "Cursus niet gevonden." };
  }

  const { data: studio } = await supabase
    .from("studios")
    .select("id")
    .eq("id", course.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Delete
  const { error } = await supabase
    .from("course_lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Teacher dashboard
// ---------------------------------------------------------------------------

/**
 * Get teacher dashboard overview (studio, students, recent activity).
 */
export async function getTeacherDashboard(): Promise<{
  studio?: {
    id: string;
    name: string;
    teacher_code: string;
    student_count: number;
    practiced_today: number;
  };
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  // Get studio
  const { data: studio } = await supabase
    .from("studios")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Studio niet gevonden." };
  }

  // Count students
  const { data: students } = await supabase
    .from("teacher_students")
    .select("student_id", { count: "exact" })
    .eq("studio_id", studio.id)
    .eq("is_active", true);

  // Count students who practiced today
  const today = new Date().toISOString().split("T")[0];
  const { data: practicedToday } = await supabase
    .from("practice_sessions")
    .select("child_id", { count: "exact" })
    .eq("studio_id", studio.id)
    .gte("started_at", `${today}T00:00:00`)
    .lte("started_at", `${today}T23:59:59`);

  return {
    studio: {
      id: studio.id,
      name: studio.name,
      teacher_code: studio.teacher_code,
      student_count: students?.length || 0,
      practiced_today: practicedToday?.length || 0,
    },
  };
}
