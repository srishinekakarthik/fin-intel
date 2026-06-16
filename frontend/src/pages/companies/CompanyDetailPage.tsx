import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, MessageSquare, FileText, Sparkles, Loader2,
  FileBarChart, GitCompare, ClipboardList,
} from 'lucide-react';
import { useCompany } from '../../hooks/useCompanies';
import { useCreateSession } from '../../hooks/useChat';
import { useGenerateHealthScore } from '../../hooks/useChat';
import { useGenerateExecutiveSummary } from '../../hooks/useAlerts';
import { useSecFilings } from '../../hooks/useAlerts';
import InvestmentMemoModal from './InvestmentMemoModal';
import CompetitorAnalysisModal from './CompetitorAnalysisModal';

function ScoreBreakdown({ breakdown }: { breakdown: Record<string, number> | null }) {
  if (!breakdown) return null;

  const labels: Record<string, string> = {
    revenueGrowth: 'Revenue Growth',
    profitability: 'Profitability',
    liquidity: 'Liquidity',
    debtLevels: 'Debt Levels',
    riskExposure: 'Risk Exposure'
  };

  // Sort according to our specific order or just use the keys present
  const keys = ['revenueGrowth', 'profitability', 'liquidity', 'debtLevels', 'riskExposure'];

  return (
    <div className="mt-5 space-y-3 border-t border-gray-800 pt-4 text-left">
      <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide">Score Breakdown</h3>
      <div className="space-y-2.5">
        {keys.map((key) => {
          const value = breakdown[key];
          if (value == null) return null;
          const label = labels[key] || key;
          const percentage = (value / 20) * 100;
          const colorClass = value >= 14 ? 'bg-emerald-500' : value >= 8 ? 'bg-amber-500' : 'bg-red-500';

          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300">{label}</span>
                <span className="text-gray-400 font-medium">{value}/20</span>
              </div>
              <div className="bg-gray-800 rounded-full h-1.5 w-full">
                <div className={`h-1.5 rounded-full transition-all ${colorClass}`} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-200 text-sm text-right max-w-xs">{value}</span>
    </div>
  );
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, isError, refetch } = useCompany(id!);
  const createSession = useCreateSession();
  const generateScore = useGenerateHealthScore();
  const execSummary = useGenerateExecutiveSummary();

  const [scoreResult, setScoreResult] = useState<null | {
    total: number; breakdown: Record<string, number>; strengths: string[]; risks: string[]; reasoning: string;
  }>(null);
  const [showMemo, setShowMemo] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showExecSummary, setShowExecSummary] = useState(false);

  const { data: secFilings } = useSecFilings(company?.ticker ?? null);

  const handleAskAI = () => {
    createSession.mutate(
      { company_id: id, title: `Chat about ${company?.name}` },
      { onSuccess: (session) => navigate(`/chat?session=${session.id}`) }
    );
  };

  const handleGenerateScore = () => {
    if (!company) return;
    generateScore.mutate(
      { companyId: company.id, companyName: company.name },
      { onSuccess: (result) => { setScoreResult(result); refetch(); } }
    );
  };

  const handleExecSummary = () => {
    if (!company) return;
    setShowExecSummary(true);
    execSummary.mutate(company.id);
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center min-h-96"><Loader2 size={24} className="text-blue-500 animate-spin" /></div>;
  }

  if (isError || !company) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Company not found.</p>
        <Link to="/companies" className="text-blue-400 text-sm hover:underline mt-2 inline-block">Back to companies</Link>
      </div>
    );
  }

  const snap = company.company_snapshots?.[0];
  const score = scoreResult?.total ?? snap?.health_score;
  const breakdown = scoreResult?.breakdown ?? snap?.score_detail;
  const scoreColor = score == null ? 'text-gray-500' : score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/companies" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Companies
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-200 text-lg font-mono font-semibold">{company.ticker?.[0] ?? company.name[0]}</span>
          </div>
          <div>
            <h1 className="text-white text-2xl font-semibold">{company.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {company.ticker   && <span className="text-blue-400 text-sm font-mono font-medium">{company.ticker}</span>}
              {company.exchange && <span className="text-gray-500 text-sm">· {company.exchange}</span>}
              {company.sector   && <span className="text-gray-500 text-sm">· {company.sector}</span>}
            </div>
          </div>
        </div>

        {company.website && (
          <a href={company.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm px-3.5 py-2 rounded-lg transition-colors">
            <Globe size={14} /> Website
          </a>
        )}
      </div>

      {/* Intelligence action bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button onClick={handleAskAI} disabled={createSession.isPending}
          className="flex items-center gap-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 text-sm px-3.5 py-2 rounded-lg transition-colors border border-blue-500/20 disabled:opacity-50">
          <MessageSquare size={14} /> {createSession.isPending ? 'Opening…' : 'Ask AI'}
        </button>
        <button onClick={() => setShowMemo(true)}
          className="flex items-center gap-1.5 bg-violet-600/15 hover:bg-violet-600/25 text-violet-400 text-sm px-3.5 py-2 rounded-lg transition-colors border border-violet-500/20">
          <FileBarChart size={14} /> Investment Memo
        </button>
        <button onClick={handleExecSummary}
          className="flex items-center gap-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 text-sm px-3.5 py-2 rounded-lg transition-colors border border-emerald-500/20">
          <ClipboardList size={14} /> Executive Summary
        </button>
        <button onClick={() => setShowCompare(true)}
          className="flex items-center gap-1.5 bg-amber-600/15 hover:bg-amber-600/25 text-amber-400 text-sm px-3.5 py-2 rounded-lg transition-colors border border-amber-500/20">
          <GitCompare size={14} /> Compare Competitors
        </button>
      </div>

      {/* Executive summary panel */}
      {showExecSummary && (
        <div className="bg-gray-900 border border-emerald-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-emerald-400 text-xs uppercase tracking-wide font-medium">Executive Summary</h2>
            <button onClick={() => setShowExecSummary(false)} className="text-gray-500 hover:text-gray-300 text-xs">Dismiss</button>
          </div>
          {execSummary.isPending ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 size={14} className="text-gray-500 animate-spin" />
              <span className="text-gray-500 text-sm">Generating with Gemini…</span>
            </div>
          ) : execSummary.isError ? (
            <p className="text-red-400 text-sm">Failed to generate summary.</p>
          ) : (
            <div className="space-y-2">
              {(execSummary.data ?? '').split('\n\n').map((para, i) => (
                <p key={i} className="text-gray-300 text-sm leading-relaxed">{para}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-1 space-y-4">

          {/* Health score */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-gray-400 text-xs uppercase tracking-wide mb-3">AI Health Score</h2>
            {score != null ? (
              <div className="text-center py-2">
                <span className={`text-5xl font-bold ${scoreColor}`}>{Math.round(score)}</span>
                <span className="text-gray-500 text-lg">/100</span>
                <div className="mt-3 bg-gray-800 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                </div>
                {scoreResult && <p className="text-gray-500 text-xs mt-4 text-left">{scoreResult.reasoning}</p>}
                
                <ScoreBreakdown breakdown={breakdown || null} />
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 text-sm mb-3">Upload company documents to generate an AI health score.</p>
              </div>
            )}
            <button onClick={handleGenerateScore} disabled={generateScore.isPending}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm py-2 rounded-lg transition-colors">
              {generateScore.isPending ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</> : <><Sparkles size={14} /> {score != null ? 'Refresh score' : 'Generate score'}</>}
            </button>
          </div>

          {/* Strengths & Risks */}
          {scoreResult && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              {scoreResult.strengths.length > 0 && (
                <div>
                  <p className="text-emerald-400 text-xs font-medium uppercase tracking-wide mb-1.5">Strengths</p>
                  <ul className="space-y-1">{scoreResult.strengths.map((s, i) => <li key={i} className="text-gray-300 text-xs flex gap-2"><span className="text-emerald-500">·</span>{s}</li>)}</ul>
                </div>
              )}
              {scoreResult.risks.length > 0 && (
                <div>
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1.5">Risks</p>
                  <ul className="space-y-1">{scoreResult.risks.map((r, i) => <li key={i} className="text-gray-300 text-xs flex gap-2"><span className="text-red-500">·</span>{r}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {/* Market snapshot */}
          {snap && (snap.stock_price != null || snap.market_cap != null) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-gray-400 text-xs uppercase tracking-wide mb-1">Market Data</h2>
              <InfoRow label="Stock price" value={snap.stock_price != null ? `$${snap.stock_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null} />
              <InfoRow label="Market cap"  value={snap.market_cap  != null ? formatMarketCap(snap.market_cap) : null} />
              <InfoRow label="P/E ratio"   value={snap.pe_ratio != null ? snap.pe_ratio.toFixed(2) : null} />
            </div>
          )}

          {/* SEC Filings */}
          {company.ticker && secFilings && secFilings.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Recent SEC Filings</h2>
              <div className="space-y-2">
                {secFilings.slice(0, 5).map((f) => (
                  <a key={f.accessionNumber} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between text-xs hover:bg-gray-800 px-2 py-1.5 -mx-2 rounded transition-colors">
                    <span className="text-gray-300 font-medium">{f.form}</span>
                    <span className="text-gray-500">{new Date(f.filingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right col */}
        <div className="lg:col-span-2 space-y-4">
          {company.description && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-gray-400 text-xs uppercase tracking-wide mb-3">About</h2>
              <p className="text-gray-300 text-sm leading-relaxed">{company.description}</p>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-gray-400 text-xs uppercase tracking-wide mb-1">Details</h2>
            <InfoRow label="Industry" value={company.industry} />
            <InfoRow label="Sector"   value={company.sector} />
            <InfoRow label="Exchange" value={company.exchange} />
            <InfoRow label="Type"     value={company.is_public ? 'Public' : 'Private'} />
            <InfoRow label="Added"    value={new Date(company.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-gray-400 text-xs uppercase tracking-wide">Documents</h2>
              <Link to={`/documents?company=${company.id}`} className="text-blue-400 text-xs hover:underline">View all</Link>
            </div>
            <div className="text-center py-6">
              <FileText size={24} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Upload documents in the Documents tab</p>
              <Link to={`/documents?company=${company.id}&upload=1`}
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg">
                Upload document
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showMemo && <InvestmentMemoModal companyId={company.id} companyName={company.name} onClose={() => setShowMemo(false)} />}
      {showCompare && <CompetitorAnalysisModal initialCompanyId={company.id} onClose={() => setShowCompare(false)} />}
    </div>
  );
}
