import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-6xl font-bold text-slate-700">404</h1>
      <p className="text-slate-400 mt-4">Page not found.</p>
      <Link
        href="/dashboard"
        className="mt-6 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}
