import { createClient } from "@supabase/supabase-js";

export default async function Home() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    const { data: movies, error } = await supabase
        .from("movies")
        .select("id, title, director")
        .order("id");

    if (error) {
        return (
            <main style={{ padding: "40px" }}>
                <h1>Error loading movies</h1>
                <p>{error.message}</p>
            </main>
        );
    }

    return (
        <main style={{ padding: "40px" }}>
            <h1>My Favorite Movies</h1>

            <ul style={{ marginTop: "20px" }}>
                {movies?.map((movie) => (
                    <li key={movie.id}>
                        {movie.title} — {movie.director}
                    </li>
                ))}
            </ul>
        </main>
    );
}