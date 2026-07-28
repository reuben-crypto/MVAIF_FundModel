import React, { useState, useMemo } from 'react'
import {
  calculateFundFees,
  calculateUSStreamReturns,
  calculateWAStreamReturns,
  calculateFundWaterfall,
} from '../../utils/mathEngine'

export default function SensitivityMatrix({ results }) {
  const [lockedStream, setLockedStream] = useState('wa') // 'us' or 'wa' - which stream stays constant
  const [lockedMoic, setLockedMoic] = useState(2.0)

  // Ranges to test on the variable stream
  const moicRange = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]

  const matrixData = useMemo(() => {
    if (!results) return []

    const { feeAnalysis, summary } = results
    const fundConfig = {
      fundSize: feeAnalysis.fundSize,
      fundLife: feeAnalysis.fundLife,
      hurdle: 0.06,
      carry: 0.20,
    }

    return moicRange.map((variableMoic) => {
      let usConfig, waConfig, usReturns, waReturns

      if (lockedStream === 'wa') {
        // WA is locked, US varies
        waConfig = { dealCap: 6, baseMoic: lockedMoic, holdingYearsMin: 4, holdingYearsMax: 6 }
        usConfig = { totalDeals: 5, equityMoic: variableMoic, holdingYearsMin: 4, holdingYearsMax: 6 }
      } else {
        // US is locked, WA varies
        usConfig = { totalDeals: 5, equityMoic: lockedMoic, holdingYearsMin: 4, holdingYearsMax: 6 }
        waConfig = { dealCap: 6, baseMoic: variableMoic, holdingYearsMin: 4, holdingYearsMax: 6 }
      }

      usReturns = calculateUSStreamReturns(summary.usCapital, usConfig)
      waReturns = calculateWAStreamReturns(summary.waCapital, waConfig)
      const waterfall = calculateFundWaterfall(usReturns, waReturns, fundConfig)

      return {
        variableMoic,
        dpi: waterfall.dpi,
        irr: waterfall.irr,
        gpCarry: waterfall.gpCarry,
        status: waterfall.dpi >= 1.5 ? 'green' : waterfall.dpi >= 1.0 ? 'yellow' : 'red',
      }
    })
  }, [results, lockedStream, lockedMoic])

  const statusColors = {
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    red: 'bg-red-100 text-red-800 border-red-300',
  }

  const statusLabels = {
    green: 'Hurdle Outperformance',
    yellow: 'Capital Recovery',
    red: 'Capital Impairment',
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Sensitivity Matrix</h2>

      {/* Controls */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hold Constant
          </label>
          <select
            value={lockedStream}
            onChange={(e) => setLockedStream(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="wa">West Africa Stream</option>
            <option value="us">US Stream</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Constant MOIC: {lockedMoic.toFixed(1)}x
          </label>
          <input
            type="range"
            min="1"
            max="4"
            step="0.1"
            value={lockedMoic}
            onChange={(e) => setLockedMoic(Number(e.target.value))}
            className="w-48"
          />
        </div>

        <div className="text-sm text-gray-600">
          Showing: <span className="font-medium">{lockedStream === 'wa' ? 'US' : 'West Africa'} Stream MOIC</span> varying,
          with <span className="font-medium">{lockedStream === 'wa' ? 'West Africa' : 'US'}</span> held at {lockedMoic.toFixed(1)}x
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
          <span>Hurdle Outperformance (Carry Generated)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
          <span>Capital Recovery (No Carry)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
          <span>Capital Impairment (Fail Point)</span>
        </div>
      </div>

      {/* Matrix Table */}
      {matrixData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="p-3 text-left">Variable MOIC</th>
                <th className="p-3 text-left">Fund DPI</th>
                <th className="p-3 text-left">Fund IRR</th>
                <th className="p-3 text-left">GP Carry</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {matrixData.map((row, idx) => (
                <tr key={idx} className={`border-2 ${statusColors[row.status]}`}>
                  <td className="p-3 font-medium">{row.variableMoic.toFixed(1)}x</td>
                  <td className="p-3">{row.dpi.toFixed(2)}x</td>
                  <td className="p-3">{(row.irr * 100).toFixed(1)}%</td>
                  <td className="p-3">${(row.gpCarry / 1000000).toFixed(2)}M</td>
                  <td className="p-3 font-medium">{statusLabels[row.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!results && (
        <p className="text-gray-500 text-center py-12">
          Configure Fund Fees, US Stream, and West Africa Stream to see sensitivity analysis.
        </p>
      )}
    </div>
  )
}
