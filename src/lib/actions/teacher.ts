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

  // Use admin client: PostgREST RLS requires auth.uid() which fails with ES256 JWTs
  // on this project. Admin client + explicit owner_id filter is equivalent and safe.
  const admin = createAdminClient();
  const { data: studio } = await admin
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

  const admin = createAdminClient();
  const { error } = await admin
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

    // Use admin client for all DB queries (ES256 JWT not verifiable by PostgREST)
    const admin = createAdminClient();

    const { data: teacherProfile } = await admin
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
    const { data: studio } = await admin
      .from("studios")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!studio) {
      return { error: "Studio niet gevonden." };
    }

    // 4. Create the student's Supabase Auth user via admin API
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

    // 5. Explicitly create the profile row for this student.
    // The handle_new_user trigger only inserts a profile for 'child' role when
    // family_id is present in metadata. Teacher-created students have no family,
    // so we must insert the profile manually here.
    const { error: profileError } = await admin.from("profiles").insert({
      id: newUser.user.id,
      family_id: null, // students created by teachers have no family
      role: "child" as const,
      display_name: displayName,
      locale: "nl",
    });

    if (profileError) {
      // If profile insert fails, clean up the auth user to avoid orphans
      await admin.auth.admin.deleteUser(newUser.user.id);
      return { error: "Kan leerlingprofiel niet aanmaken: " + profileError.message };
    }

    // 5b. Link instruments to the new student
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

    // 6a. Generate a unique student code (S-XXXX) directly in TypeScript.
    // The generate_student_code() RPC is not reliably in PostgREST's schema
    // cache, so we implement the same uniqueness-check loop here instead.
    let studentCode: string | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate =
        "S-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      const { data: existing } = await admin
        .from("teacher_students")
        .select("student_code")
        .eq("studio_id", studio.id)
        .eq("student_code", candidate)
        .maybeSingle();
      if (!existing) {
        studentCode = candidate;
        break;
      }
    }

    if (!studentCode) {
      return { error: "Kan leerlingcode niet genereren." };
    }

    // 6b. Create teacher_students relationship
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

/** Enriched student row returned by getStudents() for the list overview. */
export interface StudentOverview extends TeacherStudent {
  display_name: string;
  course_name: string | null;
  current_lesson_title: string | null;
  streak_count: number;
  last_practice_date: string | null;
}

/**
 * Get all students for the authenticated teacher's studio, enriched with
 * display name, course info, streak count, and last practice date.
 * All extra data is fetched in a single batch round-trip per table.
 */
export async function getStudents(): Promise<StudentOverview[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const admin = createAdminClient();

  // Get teacher's studio first
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!studio) return [];

  // Get all students in this studio
  const { data: students } = await admin
    .from("teacher_students")
    .select("*")
    .eq("studio_id", studio.id)
    .order("created_at", { ascending: false });

  if (!students || students.length === 0) return [];

  const studentIds = students.map((s) => s.student_id);
  const courseIds = students
    .map((s) => s.course_id)
    .filter((id): id is string => id !== null);

  // Batch-fetch all enrichment data in parallel
  const [profilesResult, coursesResult, lessonsResult, streaksResult, lastSessionsResult] =
    await Promise.all([
      // Display names
      admin.from("profiles").select("id, display_name").in("id", studentIds),

      // Course names (only for students with a course)
      courseIds.length > 0
        ? admin.from("courses").select("id, name").in("id", courseIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),

      // Current lesson titles — fetch all course_lessons for relevant courses
      // and match by level + lesson number in JS (avoids N+1 queries)
      courseIds.length > 0
        ? admin
            .from("course_lessons")
            .select("course_id, level_number, lesson_number, title")
            .in("course_id", courseIds)
        : Promise.resolve(
            { data: [] as { course_id: string; level_number: number; lesson_number: number; title: string }[] }
          ),

      // Streaks
      admin.from("streaks").select("child_id, current_count").in("child_id", studentIds),

      // Last practice session per student (most recent completed session)
      admin
        .from("practice_sessions")
        .select("child_id, started_at")
        .in("child_id", studentIds)
        .eq("status", "completed")
        .order("started_at", { ascending: false }),
    ]);

  // Build lookup maps
  const nameMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p.display_name])
  );
  const courseMap = new Map(
    (coursesResult.data ?? []).map((c) => [c.id, c.name])
  );
  const streakMap = new Map(
    (streaksResult.data ?? []).map((s) => [s.child_id, s.current_count])
  );

  // Build lesson title lookup: "courseId:level:lesson" → title
  const lessonTitleMap = new Map(
    (lessonsResult.data ?? []).map((l) => [
      `${l.course_id}:${l.level_number}:${l.lesson_number}`,
      l.title,
    ])
  );

  // Last practice date: take the first occurrence per child_id (already sorted desc)
  const lastPracticeMap = new Map<string, string>();
  for (const s of lastSessionsResult.data ?? []) {
    if (!lastPracticeMap.has(s.child_id)) {
      lastPracticeMap.set(s.child_id, s.started_at);
    }
  }

  return students.map((s) => ({
    ...s,
    display_name: nameMap.get(s.student_id) ?? s.student_code,
    course_name: s.course_id ? (courseMap.get(s.course_id) ?? null) : null,
    current_lesson_title: s.course_id
      ? (lessonTitleMap.get(`${s.course_id}:${s.current_level}:${s.current_lesson}`) ?? null)
      : null,
    streak_count: streakMap.get(s.student_id) ?? 0,
    last_practice_date: lastPracticeMap.get(s.student_id) ?? null,
  }));
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
    can_send_messages?: boolean;
    course_name?: string | null;
    current_lesson_title?: string | null;
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

  const admin = createAdminClient();

  // Verify teacher owns this student
  const { data: student } = await admin
    .from("teacher_students")
    .select("*")
    .eq("student_id", studentId)
    .single();

  if (!student) {
    return { error: "Leerling niet gevonden." };
  }

  // Verify this teacher owns the studio
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", student.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Get student's profile for name and messaging permission
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, can_send_messages")
    .eq("id", studentId)
    .single();

  // Get student's streak
  const { data: streak } = await admin
    .from("streaks")
    .select("current_count")
    .eq("child_id", studentId)
    .single();

  // Get student's total points
  const { data: points } = await admin
    .from("points")
    .select("amount")
    .eq("child_id", studentId);

  // Get student's total credits
  const { data: credits } = await admin
    .from("super_credits")
    .select("amount")
    .eq("child_id", studentId);

  const totalPoints = points?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalCredits = credits?.reduce((sum, c) => sum + c.amount, 0) || 0;

  // Optionally fetch the course name and current lesson title
  let courseName: string | null = null;
  let currentLessonTitle: string | null = null;

  if (student.course_id) {
    const { data: course } = await admin
      .from("courses")
      .select("name")
      .eq("id", student.course_id)
      .single();

    if (course) {
      courseName = course.name;

      // Fetch current lesson title
      const { data: currentLesson } = await admin
        .from("course_lessons")
        .select("title")
        .eq("course_id", student.course_id)
        .eq("level_number", student.current_level)
        .eq("lesson_number", student.current_lesson)
        .single();

      currentLessonTitle = currentLesson?.title ?? null;
    }
  }

  return {
    student: {
      ...student,
      name: profile?.display_name || "Onbekend",
      streak_count: streak?.current_count || 0,
      total_points: totalPoints,
      total_credits: totalCredits,
      can_send_messages: profile?.can_send_messages ?? false,
      course_name: courseName,
      current_lesson_title: currentLessonTitle,
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

  const admin = createAdminClient();

  // Verify teacher owns this student
  const { data: student } = await admin
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", studentId)
    .single();

  if (!student) {
    return { error: "Leerling niet gevonden." };
  }

  // Verify teacher owns the studio
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", student.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Update progress
  const { error } = await admin
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
 * Toggle a student's can_send_messages permission.
 * Verifies the authenticated teacher owns the studio the student belongs to.
 */
export async function updateStudentCanSendMessages(
  studentId: string,
  canSend: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  const admin = createAdminClient();

  // Verify teacher owns this student
  const { data: student } = await admin
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", studentId)
    .single();

  if (!student) {
    return { error: "Leerling niet gevonden." };
  }

  // Verify teacher owns the studio
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", student.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Update the can_send_messages flag on the student's profile
  const { error } = await admin
    .from("profiles")
    .update({ can_send_messages: canSend })
    .eq("id", studentId);

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

  const admin = createAdminClient();

  // Verify teacher owns this student
  const { data: student } = await admin
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", studentId)
    .single();

  if (!student) {
    return { error: "Leerling niet gevonden." };
  }

  // Verify teacher owns the studio
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", student.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Deactivate
  const { error } = await admin
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

  const admin = createAdminClient();

  // Get teacher's studio
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Studio niet gevonden." };
  }

  // Create course
  const { data: course, error } = await admin
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

  const admin = createAdminClient();

  // Get teacher's studio
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!studio) return [];

  // Get courses
  const { data: courses } = await admin
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

  const admin = createAdminClient();

  // Get course
  const { data: course } = await admin
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) {
    return { error: "Cursus niet gevonden." };
  }

  // Verify teacher owns this course
  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", course.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Get lessons
  const { data: lessons } = await admin
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
 * Get a single course lesson by ID. Verifies teacher ownership.
 */
export async function getLessonById(lessonId: string): Promise<{
  lesson?: CourseLesson;
  courseId?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const admin = createAdminClient();

  const { data: lesson } = await admin
    .from("course_lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (!lesson) return { error: "Les niet gevonden." };

  // Verify teacher owns the course via studio
  const { data: course } = await admin
    .from("courses")
    .select("id, studio_id")
    .eq("id", lesson.course_id)
    .single();

  if (!course) return { error: "Cursus niet gevonden." };

  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", course.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) return { error: "Geen toestemming." };

  return { lesson, courseId: course.id };
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

  const admin = createAdminClient();

  // Verify teacher owns this course
  const { data: course } = await admin
    .from("courses")
    .select("studio_id")
    .eq("id", courseId)
    .single();

  if (!course) {
    return { error: "Cursus niet gevonden." };
  }

  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", course.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Upsert lesson
  const { data: lesson, error } = await admin
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

  const admin = createAdminClient();

  // Get lesson + verify ownership
  const { data: lesson } = await admin
    .from("course_lessons")
    .select("course_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) {
    return { error: "Les niet gevonden." };
  }

  const { data: course } = await admin
    .from("courses")
    .select("studio_id")
    .eq("id", lesson.course_id)
    .single();

  if (!course) {
    return { error: "Cursus niet gevonden." };
  }

  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", course.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) {
    return { error: "Geen toestemming." };
  }

  // Delete
  const { error } = await admin
    .from("course_lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Course assignment & lesson progress
// ---------------------------------------------------------------------------

/**
 * Assign (or unassign) a course to a student and reset their progress to 1/1.
 *
 * Called by the teacher from the student detail page.
 * Verifies:
 *   - teacher is authenticated
 *   - student belongs to teacher's studio
 *   - if courseId is provided, the course also belongs to that studio
 */
export async function updateStudentCourse(
  studentId: string,
  courseId: string | null
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  const admin = createAdminClient();

  // Verify teacher owns this student (via studio ownership)
  const { data: ts } = await admin
    .from("teacher_students")
    .select("studio_id")
    .eq("student_id", studentId)
    .single();

  if (!ts) return { error: "Leerling niet gevonden." };

  const { data: studio } = await admin
    .from("studios")
    .select("id")
    .eq("id", ts.studio_id)
    .eq("owner_id", user.id)
    .single();

  if (!studio) return { error: "Geen toestemming." };

  // If assigning a course, verify it belongs to the same studio
  if (courseId !== null) {
    const { data: course } = await admin
      .from("courses")
      .select("studio_id")
      .eq("id", courseId)
      .single();

    if (!course || course.studio_id !== ts.studio_id) {
      return { error: "Cursus behoort niet tot jouw studio." };
    }
  }

  // Update course_id and reset progress to level 1 / lesson 1
  const { error } = await admin
    .from("teacher_students")
    .update({
      course_id: courseId,
      current_level: 1,
      current_lesson: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId);

  if (error) return { error: error.message };

  return { success: true };
}

/**
 * Advance a student to the next lesson in their assigned course.
 *
 * Called by the STUDENT after completing a practice session.
 * Security: verifies the teacher_students row belongs to the authenticated user
 * (student_id = user.id) to prevent IDOR.
 *
 * Returns { completed: true } when the student finishes the final lesson of the
 * final level — no further advancement is performed in that case.
 */
export async function advanceStudentLesson(
  tsId: string // teacher_students.id (PK of the relationship row)
): Promise<{ success?: boolean; completed?: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Niet ingelogd." };

  const admin = createAdminClient();

  // Fetch the row + verify the student owns it (IDOR protection)
  const { data: ts } = await admin
    .from("teacher_students")
    .select("id, student_id, course_id, current_level, current_lesson")
    .eq("id", tsId)
    .eq("student_id", user.id)
    .single();

  if (!ts) return { error: "Geen toestemming." };
  if (!ts.course_id) return { error: "Geen cursus gekoppeld." };

  // Fetch course's total_levels for boundary checking
  const { data: course } = await admin
    .from("courses")
    .select("total_levels")
    .eq("id", ts.course_id)
    .single();

  if (!course) return { error: "Cursus niet gevonden." };

  // Find the highest lesson_number in the current level
  const { data: topLesson } = await admin
    .from("course_lessons")
    .select("lesson_number")
    .eq("course_id", ts.course_id)
    .eq("level_number", ts.current_level)
    .order("lesson_number", { ascending: false })
    .limit(1);

  const maxLessonInLevel = topLesson?.[0]?.lesson_number ?? ts.current_lesson;

  let newLevel = ts.current_level;
  let newLesson = ts.current_lesson;
  let completed = false;

  if (ts.current_lesson < maxLessonInLevel) {
    // Advance to next lesson in the same level
    newLesson = ts.current_lesson + 1;
  } else if (ts.current_level < course.total_levels) {
    // Last lesson of this level — move to level 1 of next level
    newLevel = ts.current_level + 1;
    newLesson = 1;
  } else {
    // Final lesson of final level — course completed, don't advance
    completed = true;
  }

  if (!completed) {
    const { error } = await admin
      .from("teacher_students")
      .update({
        current_level: newLevel,
        current_lesson: newLesson,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tsId);

    if (error) return { error: error.message };
  }

  return { success: true, completed };
}

// ---------------------------------------------------------------------------
// Teacher dashboard
// ---------------------------------------------------------------------------

/**
 * Shape of a recent practice session returned by the teacher dashboard.
 */
export interface RecentSession {
  id: string;
  child_id: string;
  instrument_id: string | null;
  duration_seconds: number | null;
  started_at: string;
  status: string;
  student_name: string;
  instrument_name_key: string | null;
}

/**
 * Get teacher dashboard overview (studio, students, recent activity).
 *
 * NOTE: Uses admin client for all DB queries because PostgREST cannot verify
 * ES256 JWTs on this project, causing auth.uid() to return NULL and RLS to
 * block all queries. Security is maintained via explicit owner_id/studio_id
 * filters on the verified user.id from getUser() (Auth API, not PostgREST).
 */
export async function getTeacherDashboard(): Promise<{
  studio?: {
    id: string;
    name: string;
    teacher_code: string;
    student_count: number;
    practiced_today: number;
  };
  recentSessions?: RecentSession[];
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Niet ingelogd." };
  }

  const admin = createAdminClient();

  const { data: studio } = await admin
    .from("studios")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!studio) {
    return { error: "Studio niet gevonden." };
  }

  // Count active students
  const { data: students } = await admin
    .from("teacher_students")
    .select("student_id", { count: "exact" })
    .eq("studio_id", studio.id)
    .eq("is_active", true);

  // Count students who practiced today
  const today = new Date().toISOString().split("T")[0];
  const { data: practicedToday } = await admin
    .from("practice_sessions")
    .select("child_id", { count: "exact" })
    .eq("studio_id", studio.id)
    .gte("started_at", `${today}T00:00:00`)
    .lte("started_at", `${today}T23:59:59`);

  // Get recent practice sessions with student + instrument names
  const { data: rawSessions } = await admin
    .from("practice_sessions")
    .select("id, child_id, instrument_id, duration_seconds, started_at, status")
    .eq("studio_id", studio.id)
    .gte("started_at", `${today}T00:00:00`)
    .order("started_at", { ascending: false })
    .limit(10);

  // Enrich sessions with student and instrument display names
  const recentSessions: RecentSession[] = [];
  for (const session of rawSessions ?? []) {
    const [{ data: profile }, { data: instrument }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", session.child_id).single(),
      session.instrument_id
        ? admin.from("instruments").select("name_key").eq("id", session.instrument_id).single()
        : Promise.resolve({ data: null }),
    ]);
    recentSessions.push({
      ...session,
      student_name: profile?.display_name ?? "Onbekende leerling",
      instrument_name_key: instrument?.name_key ?? null,
    });
  }

  return {
    studio: {
      id: studio.id,
      name: studio.name,
      teacher_code: studio.teacher_code,
      student_count: students?.length || 0,
      practiced_today: practicedToday?.length || 0,
    },
    recentSessions,
  };
}
