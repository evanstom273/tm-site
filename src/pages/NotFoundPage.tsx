import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Not found</h1>
      <Link to="/" className="text-sm text-sky-700 hover:underline dark:text-sky-400">
        Back to the tables
      </Link>
    </div>
  );
}
