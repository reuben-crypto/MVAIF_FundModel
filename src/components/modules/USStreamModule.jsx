import React from 'react'

export default function USStreamModule({ config, onChange, results }) {
  const handleChange = (field, value) => {
    onChange({ [field]: value })
  }

  const formatCurrency = (val) => `$${(val / 1000000).toFixed(2)}M`
  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`

  const derivedPikRate = Math.max(0, config.debtTotalRate - config.debtCashRate)

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">US Search Deals</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT COLUMN: INPUTS */}
        <div className="space-y-6">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deals Per Year</label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.dealsPerYear}
              onChange={(e) => handleChange('dealsPerYear', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Target Deals</label>
            <input
              type="number"
              min="1"
              max="20"
              value={config.totalDeals}
              onChange={(e) => handleChange('totalDeals', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hold Min (yrs)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Hold Max (yrs)</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Average Equity MOIC Case</label>
            <select
              value={config.equityMoic}
              onChange={(e) => handleChange('equityMoic', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value={2.0}>2.0x (Downside)</option>
              <option value={3.0}>3.0x (Base)</option>
              <option value={3.5}>3.5x (Upside)</option>
            </select>
          </div>

          <hr className="border-gray-200" />
          <h3 className="font-semibold text-gray-800">Capital Instrument Structure</h3>

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
          </div>

          {/* CONNECTED DEBT INTEREST STRUCTURE */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <p className="text-sm font-medium text-blue-900">Debt Interest Structure (connected)</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Interest Rate: {(config.debtTotalRate * 100).toFixed(2)}%
              </label>
              <input
                type="range"
                min="0"
                max="0.25"
                step="0.0025"
                value={config.debtTotalRate}
                onChange={(e) => handleChange('debtTotalRate', Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cash Interest Rate (portion of total): {(config.debtCashRate * 100).toFixed(2)}%
              </label>
              <input
                type="range"
                min="0"
                max={config.debtTotalRate}
                step="0.0025"
                value={config.debtCashRate}
                onChange={(e) => handleChange('debtCashRate', Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex justify-between text-sm bg-white rounded p-3 border border-blue-100">
              <span className="text-gray-600">PIK Rate (auto-calculated)</span>
              <span className="font-semibold text-blue-700">{formatPercent(derivedPikRate)}</span>
            </div>
            <p className="text-xs text-gray-500">
              PIK = Total Rate − Cash Rate. Compounds annually, capitalized and paid with principal at exit.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voting Shares (max 9%): {(config.votingSharesRate * 100).toFixed(1)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.09"
              step="0.005"
              value={config.votingSharesRate}
              onChange={(e) => handleChange('votingSharesRate', Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Equity Rate: {(config.prefEquityRate * 100).toFixed(1)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.15"
              step="0.005"
              value={config.prefEquityRate}
              onChange={(e) => handleChange('prefEquityRate', Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Equity Method</label>
            <select
              value={config.prefEquityMethod}
              onChange={(e) => handleChange('prefEquityMethod', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="compound">Compounded Annually</option>
              <option value="simple">Accrued Simple Interest</option>
            </select>
          </div>

          <hr className="border-gray-200" />
          <h3 className="font-semibold text-gray-800">Searcher Economics</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Searcher Upfront Equity: {(config.searcherEquityAlloc * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0025"
              value={config.searcherEquityAlloc}
              onChange={(e) => handleChange('searcherEquityAlloc', Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Searcher Debt Economics</label>
            <select
              value={config.searcherDebtEconomics}
              onChange={(e) => handleChange('searcherDebtEconomics', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="option1">Option 1: 1% PIK (subordinated)</option>
              <option value="option2">Option 2: 0.5% Cash + 0.5% PIK</option>
              <option value="option3">Option 3: 0.5% to Fund Expenses</option>
            </select>
          </div>

          <div className="bg-gray-50 rounded p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Tiered Searcher Carry</p>
            <p>
              If MOIC ≤ {config.searcherCarryThreshold}x: {(config.searcherCarryBelow * 100).toFixed(1)}% carry
            </p>
            <p>
              If MOIC ≥ {config.searcherCarryThreshold}x: {(config.searcherCarryAbove * 100).toFixed(1)}% carry
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: OUTPUTS */}
        <div>
          {results && (
            <div className="bg-gray-50 rounded-lg p-6 lg:sticky lg:top-44">
              <h3 className="font-semibold text-gray-900 mb-4">US Stream Output</h3>

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
                  <span className="font-medium text-green-600">{formatCurrency(results.totalGrossProceeds)}</span>
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
                      <span>Debt Tranche Returns</span>
                      <span>{formatCurrency(results.perDealMetrics.debtReturns)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Equity Tranche Returns</span>
                      <span>{formatCurrency(results.perDealMetrics.equityReturns)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Deal MOIC</span>
                      <span>{results.perDealMetrics.dealMoic.toFixed(2)}x</span>
                    </div>
                  </div>
                </div>
              )}

              {results.searcherEconomics && (
                <div className="mt-6 pt-4 border-t border-gray-300">
                  <h4 className="font-medium text-gray-700 mb-2">Searcher Economics</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Equity Value</span>
                      <span>{formatCurrency(results.searcherEconomics.equityValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Debt Economic Value</span>
                      <span>{formatCurrency(results.searcherEconomics.debtEconomicValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Applicable Carry</span>
                      <span>{formatPercent(results.searcherEconomics.carryRate)}</span>
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
