import React from 'react'

export default function PerformanceStrip({ results }) {
  if (!results) return null

  const { summary, fundWaterfall } = results

  const formatCurrency = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`
    return `$${val.toLocaleString()}`
  }

  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`

  const metrics = [
    { label: 'Gross IRR', value: formatPercent(fundWaterfall.grossIRR), color: 'text-blue-400' },
    { label: 'Net IRR', value: formatPercent(fundWaterfall.netIRR), color: 'text-blue-400' },
    { label: 'Combined DPI', value: `${fundWaterfall.dpi.toFixed(2)}x`, color: 'text-green-400' },
    { label: 'Investible Capital', value: formatCurrency(summary.investibleCapital), color: 'text-white' },
    { label: 'Total Carry', value: formatCurrency(fundWaterfall.gpCarry), color: 'text-purple-400' },
  ]

  return (
    <div className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {metrics.map((metric, idx) => (
            <div key={idx} className="text-center md:text-left">
              <div className="text-xs uppercase tracking-wide text-gray-400">{metric.label}</div>
              <div className={`text-xl font-bold ${metric.color}`}>{metric.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
