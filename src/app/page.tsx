import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold">AL Base</h1>
      <p className="mt-4 text-gray-500">AI-powered adaptive learning platform</p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/ws-demo"
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          WebSocket Demo
        </Link>
        <Link
          href="/speech-demo"
          className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
        >
          Speech Assessment
        </Link>
        <Link
          href="/speech-realtime"
          className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
        >
          Realtime Speech
        </Link>
      </div>
    </main>
  );
}
