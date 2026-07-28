import React from 'react'

export default function FundFeesModule({ config, onChange, results }) {
  const handleChange = (field, value) => {
    onChange({ [field]: value })
  }

  const formatCurrency = (val) => `$${(val / 1000000).toFixed(2)}M`

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Fund Overview & Fees</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT COLUMN: INPUTS */}
        <div className="space-y-6 lg:sticky lg:top-44 lg:self-start lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-2">
          {/* Fund Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fund Size (USD)</label>
            <input
              type="number"
              value={config.fundSize}
              onChange={(e) => handleChange('fundSize', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          {/* Fund Life */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fund Life (Years)</label>
            <select
              value={config.fundLife}
              onChange={(e) => handleChange('fundLife', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value={10}>10 Years (Base)</option>
              <option value={11}>11 Years (+1 Extension)</option>
              <option value={12}>12 Years (+2 Extension)</option>
            </select>
          </div>

          {/* Management Fee Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Management Fee Rate: {(config.mgtFeeRate * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0025"
              value={config.mgtFeeRate}
              onChange={(e) => handleChange('mgtFeeRate', Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Management Fee Base</label>
            <select
              value={config.mgtFeeBase}
              onChange={(e) => handleChange('mgtFeeBase', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="committed">Committed Capital</option>
              <option value="aum">AUM</option>
            </select>
          </div>

          {/* Step-Down Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Step-Down Fee (Year 6+)</label>
            <input
              type="checkbox"
              checked={config.stepDownActive}
              onChange={(e) => handleChange('stepDownActive', e.target.checked)}
              className="h-5 w-5"
            />
          </div>

          {config.stepDownActive && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step-Down Rate: {(config.stepDownRate * 100).toFixed(2)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.03"
                  step="0.0025"
                  value={config.stepDownRate}
                  onChange={(e) => handleChange('stepDownRate', Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Step-Down Base</label>
                <select
                  value={config.stepDownBase}
                  onChange={(e) => handleChange('stepDownBase', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="committed">Committed Capital</option>
                  <option value="aum">AUM</option>
                </select>
              </div>
            </>
          )}

          {/* Org Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organizational Fee: {(config.orgFeeRate * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.03"
              step="0.0025"
              value={config.orgFeeRate}
              onChange={(e) => handleChange('orgFeeRate', Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organizational Fee Base</label>
            <select
              value={config.orgFeeBase}
              onChange={(e) => handleChange('orgFeeBase', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="committed">Committed Capital</option>
              <option value="aum">AUM</option>
            </select>
            {config.orgFeeBase === 'aum' && (
              <p className="text-xs text-amber-600 mt-1">
                Note: Org fee is charged at fund close, before deployment — AUM is $0 at that
                moment, so this will compute as $0. Choose Committed Capital for a non-zero org fee.
              </p>
            )}
          </div>

          {/* OpEx Years 1-5 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpEx Years 1-5: {(config.opexYears1to5Rate * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.02"
              step="0.001"
              value={config.opexYears1to5Rate}
              onChange={(e) => handleChange('opexYears1to5Rate', Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OpEx Years 1-5 Base</label>
            <select
              value={config.opexYears1to5Base}
              onChange={(e) => handleChange('opexYears1to5Base', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="committed">Committed Capital</option>
              <option value="aum">AUM</option>
            </select>
          </div>

          {/* OpEx Years 6-10 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpEx Years 6-10: {(config.opexYears6to10Rate * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.02"
              step="0.001"
              value={config.opexYears6to10Rate}
              onChange={(e) => handleChange('opexYears6to10Rate', Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">OpEx Years 6-10 Base</label>
            <select
              value={config.opexYears6to10Base}
              onChange={(e) => handleChange('opexYears6to10Base', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="committed">Committed Capital</option>
              <option value="aum">AUM</option>
            </select>
          </div>

          {/* Hurdle Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hurdle Rate: {(config.hurdle * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.15"
              step="0.005"
              value={config.hurdle}
              onChange={(e) => handleChange('hurdle', Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Carry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carry Percentage: {(config.carry * 100).toFixed(2)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.30"
              step="0.01"
              value={config.carry}
              onChange={(e) => handleChange('carry', Number(e.target.value))}
              className="w-full"
            />
          </div>

          <hr className="border-gray-200" />
          <h3 className="font-semibold text-gray-800">
            Exit Configuration <span className="text-xs font-normal text-gray-500">(applies to both streams)</span>
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exit Timing</label>
            <select
              value={config.exitTiming}
              onChange={(e) => handleChange('exitTiming', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="holding">At End of Holding Period (per deal)</option>
              <option value="fixedYear">Fixed Year (all deals exit same year)</option>
            </select>
          </div>

          {config.exitTiming === 'fixedYear' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Exit Year</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.fixedExitYear || 5}
                onChange={(e) => handleChange('fixedExitYear', Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exit Tranches (years to spread proceeds over)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={config.exitTranches}
              onChange={(e) => handleChange('exitTranches', Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              1 = full exit at once. 2+ = proceeds spread evenly across that many consecutive years starting at exit.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: OUTPUTS */}
        <div>
          {results && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Fee Waterfall Output</h3>
              <div className="space-y-3">
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Fund Size</span>
                  <span className="font-medium">{formatCurrency(results.feeAnalysis.fundSize)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Total Mgt Fees</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(results.feeAnalysis.totalMgtFees)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Org Fee</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(results.feeAnalysis.totalOrgFee)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Total OpEx</span>
                  <span className="font-medium text-red-600">-{formatCurrency(results.feeAnalysis.totalOpex)}</span>
                </div>
                <div className="flex justify-between pt-2 text-lg font-bold">
                  <span>Investible Capital</span>
                  <span className="text-green-600">{formatCurrency(results.feeAnalysis.investibleCapital)}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-300">
                <h4 className="font-medium text-gray-700 mb-2">Stream Allocation</h4>
                <div className="flex justify-between text-sm">
                  <span>US Stream</span>
                  <span>{formatCurrency(results.summary.usCapital)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>West Africa Stream</span>
                  <span>{formatCurrency(results.summary.waCapital)}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-300">
                <h4 className="font-medium text-gray-700 mb-2">Fund-Level Result</h4>
                <div className="flex justify-between text-sm">
                  <span>Final AUM (Year {results.summary.fundLife})</span>
                  <span>{formatCurrency(results.summary.finalAUM)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
