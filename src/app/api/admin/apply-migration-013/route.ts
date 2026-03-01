import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Admin endpoint to apply Migration 013: Add 'student' role to user_role enum
 * This migration is needed for teacher-managed student profiles.
 *
 * POST /api/admin/apply-migration-013
 * Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization using service role key
    const authHeader = request.headers.get("authorization");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Service role key not configured" },
        { status: 500 }
      );
    }

    if (!authHeader?.includes(serviceRoleKey)) {
      return NextResponse.json(
        { error: "Unauthorized - invalid credentials" },
        { status: 401 }
      );
    }

    // Create admin client with service role (bypasses RLS)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie errors in API context
            }
          },
        },
      }
    );

    console.log("🔧 Applying Migration 013...");
    console.log("📝 SQL: ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student';");

    // Execute the migration SQL
    // Using rpc call - note: this requires a custom RPC function in Supabase
    // For now, we'll document the manual process

    return NextResponse.json({
      success: true,
      message: "Migration 013 - Ready to apply",
      instruction: "This migration must be applied manually through Supabase SQL Editor",
      sql: "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student';",
      steps: [
        "1. Go to https://supabase.com/dashboard",
        "2. Select your project: tlbvbktvqxawcmgksxls",
        "3. Go to SQL Editor",
        "4. Create new query",
        "5. Paste: ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student';",
        "6. Click 'Run'"
      ],
      note: "This adds the 'student' role to the user_role ENUM type for teacher-managed student accounts"
    });
  } catch (err) {
    console.error("Migration endpoint error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
