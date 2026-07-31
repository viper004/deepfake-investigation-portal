export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-slate-400 text-sm font-medium">Active Cases</h3>
          <p className="text-3xl font-bold text-white mt-2">12</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-slate-400 text-sm font-medium">Evidence Files</h3>
          <p className="text-3xl font-bold text-white mt-2">148</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-slate-400 text-sm font-medium">Deepfakes Detected</h3>
          <p className="text-3xl font-bold text-white mt-2">34</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-slate-400 text-sm font-medium">Pending Reviews</h3>
          <p className="text-3xl font-bold text-white mt-2">7</p>
        </div>
      </div>
    </div>
  );
}
