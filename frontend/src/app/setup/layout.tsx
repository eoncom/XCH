export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        {children}
      </div>
    </div>
  );
}
