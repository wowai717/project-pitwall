export default function Loading() {
  return (
    <div className="min-h-screen bg-neutral-950 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="h-12 w-48 bg-neutral-800 rounded-md animate-pulse mb-2"></div>
        <div className="h-6 w-64 bg-neutral-900 rounded-md animate-pulse mb-8"></div>
        
        {/* 탭 스켈레톤 */}
        <div className="flex gap-2 mb-8 bg-neutral-900 p-2 rounded-lg w-fit">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 w-20 bg-neutral-800 rounded-md animate-pulse"></div>
          ))}
        </div>

        {/* 리스트 스켈레톤 */}
        <div className="grid gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-24 bg-neutral-900 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}