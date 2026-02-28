import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./src/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

/** Routes accessible without authentication */
const publicPaths = ["/login", "/register", "/forgot-password"];

/** Routes that require auth but should NOT redirect away already-logged-in users */
const authRequiredNoRedirect = ["/reset-password"];

/** Routes restricted to parent role */
const parentOnlyPaths = ["/dashboard", "/children", "/settings", "/inbox"];

/** Routes restricted to teacher role */
const teacherOnlyPaths = ["/teacher"];

/**
 * Extract the path segment after the locale prefix.
 * E.g. "/nl/dashboard" → "/dashboard", "/en/login" → "/login"
 */
function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(nl|en)/, "") || "/";
}

/**
 * Detect the locale from the URL or fall back to "nl".
 */
function getLocale(pathname: string): string {
  return pathname.match(/^\/(nl|en)/)?.[1] || "nl";
}

export async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session and get the current user
  const { response: supabaseResponse, user } = await updateSession(request);

  // 2. Apply internationalization routing (locale detection + prefix)
  const intlResponse = intlMiddleware(request);

  // 3. Merge Supabase auth cookies into the i18n response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  const pathname = request.nextUrl.pathname;
  const path = stripLocale(pathname);
  const locale = getLocale(pathname);

  // 4a. Auth-required routes that should not redirect (e.g. password reset)
  const isAuthNoRedirect = authRequiredNoRedirect.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (isAuthNoRedirect) {
    // User must be logged in (session from email link), but don't redirect away
    if (!user) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
    return intlResponse;
  }

  // 4b. Public routes — allow everyone, but redirect authenticated users away
  const isPublic = publicPaths.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (isPublic) {
    if (user) {
      // Already signed in — send to the correct dashboard
      const role = user.user_metadata?.role;
      let dest: string;
      if (role === "child") {
        dest = `/${locale}/home`;
      } else if (role === "teacher") {
        dest = `/${locale}/teacher/dashboard`;
      } else {
        dest = `/${locale}/dashboard`;
      }
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return intlResponse;
  }

  // 5. Protected routes — require authentication
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // 6. Role-based access control
  const role = user.user_metadata?.role;

  // Children cannot access parent-only or teacher-only routes
  if (role === "child") {
    if (
      parentOnlyPaths.some((p) => path.startsWith(p)) ||
      teacherOnlyPaths.some((p) => path.startsWith(p))
    ) {
      return NextResponse.redirect(new URL(`/${locale}/home`, request.url));
    }
  }

  // Teachers cannot access parent-only routes
  if (
    role === "teacher" &&
    parentOnlyPaths.some((p) => path.startsWith(p))
  ) {
    return NextResponse.redirect(new URL(`/${locale}/teacher/dashboard`, request.url));
  }

  // Parents are allowed to view child/teacher routes (for preview / oversight)

  // 7. Root locale path — redirect based on role
  if (path === "/" || path === "") {
    let dest: string;
    if (role === "child") {
      dest = `/${locale}/home`;
    } else if (role === "teacher") {
      dest = `/${locale}/teacher/dashboard`;
    } else {
      dest = `/${locale}/dashboard`;
    }
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except static files and API routes
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
