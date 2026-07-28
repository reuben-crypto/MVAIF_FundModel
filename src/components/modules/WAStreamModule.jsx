import React from 'react'

export default function WAStreamModule({ config, onChange, results }) {
  const handleChange = (field, value) => {
    onChange({ [field]: value })
  }

  const formatCurrency = (val) => `$${(val / 1000000).toFixed(2)}M`
  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">West Africa Deals</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT COLUMN: INPUTS */}
        <div className="space-y-6">
          {/* Stream Allocation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stream Allocation: {(config.streamAllocationPct * 100).toFixed(0)}% of Investible Capital
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.streamAllocationPct}
              onChange={(e) => handleChange('streamAllocationPct', Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Deals Per Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deals Per Year
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.dealsPerYear}
              onChange={(e) => handleChange('dealsPerYear', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          {/* Deal Cap */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Deal Cap (Hard Limit)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={config.dealCap}
              onChange={(e) => handleChange('dealCap', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          {/* Holding Period Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hold Min (yrs)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.holdingYearsMin}
                onChange={(e) => handleChange('holdingYearsMin', Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hold Max (yrs)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.holdingYearsMax}
                onChange={(e) => handleChange('holdingYearsMax', Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Base Case MOIC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Case MOIC: {config.baseMoic.toFixed(2)}x
            </label>
            <input
              type="range"
              min="1"
              max="4"
              step="0.1"
              value={config.baseMoic}
              onChange={(e) => handleChange('baseMoic', Number(e.target.value))}
              className="w-full"
            />
          </div>

          <hr className="border-gray-200" />
          <h3 className="font-semibold text-gray-800">Capital Instrument Structure</h3>

          {/* Debt/Equity Split - Fixed 70/30 but variable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Debt Allocation: {(config.debtAllocation * 100).toFixed(0)}% / Equity: {((1 - config.debtAllocation) * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.debtAllocation}
              onChange={(e) => {
                const debt = Number(e.target.value)
                onChange({ debtAllocation: debt, equityAllocation: 1 - debt })
              }}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Default structure: 70% Debt / 30% Equity</p>
          </div>
        </div>

        {/* RIGHT COLUMN: OUTPUTS */}
        <div>
          {results && (
            <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">West Africa Stream Output</h3>

              <div className="space-y-3">
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Deal Count</span>
                  <span className="font-medium">{results.dealCount}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Avg Deal Size</span>
                  <span className="font-medium">{formatCurrency(results.avgDealSize)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Total Invested</span>
                  <span className="font-medium">{formatCurrency(results.totalInvested)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Gross Proceeds</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(results.totalGrossProceeds)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Gross IRR</span>
                  <span className="font-medium text-blue-600">{formatPercent(results.grossIRR)}</span>
                </div>
                <div className="flex justify-between pt-2 text-lg font-bold">
                  <span>Stream DPI</span>
                  <span className="text-green-600">{results.dpi.toFixed(2)}x</span>
                </div>
              </div>

              {results.perDealMetrics && (
                <div className="mt-6 pt-4 border-t border-gray-300">
                  <h4 className="font-medium text-gray-700 mb-2">Per-Deal Breakdown</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Debt Tranche</span>
                      <span>{formatCurrency(results.perDealMetrics.debtTranche)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Equity Tranche</span>
                      <span>{formatCurrency(results.perDealMetrics.equityTranche)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Deal MOIC</span>
                      <span>{results.perDealMetrics.dealMoic.toFixed(2)}x</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
