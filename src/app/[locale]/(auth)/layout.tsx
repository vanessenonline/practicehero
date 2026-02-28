/**
 * Auth layout - minimal layout without navigation bars.
 * Used for login and registration pages.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-purple-50 to-blue-50">
      <div className="w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
