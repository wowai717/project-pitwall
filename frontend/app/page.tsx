export default function HomePage() {
	return (
		<main className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
			<div className="text-center space-y-4 p-8">
				<p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
					Pitwall
				</p>
				<h1 className="text-4xl font-bold">Formula 1 dashboard</h1>
				<a
					className="inline-flex items-center rounded-full bg-red-500 px-5 py-3 font-medium text-black transition-colors hover:bg-red-400"
					href="/standings"
				>
					View standings
				</a>
			</div>
		</main>
	);
}
