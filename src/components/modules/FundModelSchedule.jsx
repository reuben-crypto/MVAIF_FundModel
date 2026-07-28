import React, { useState } from 'react'

const OPTIONAL_COLUMNS = [
  { key: 'mgtFee', label: 'Mgt Fee' },
  { key: 'opex', label: 'OpEx' },
  { key: 'orgFee', label: 'Org Fee' },
  { key: 'usCapitalDeployed', label: 'US Capital Deployed' },
  { key: 'waCapitalDeployed', label: 'WA Capital Deployed' },
  { key: 'usDistributions', label: 'US Distributions' },
  { key: 'waDistributions', label: 'WA Distributions' },
  { key: 'unrealizedFV', label: 'Unrealized FV' },
  { key: 'carryDeduction', label: 'GP Carry Deducted' },
  { key: 'netCashFlow', label: 'Net Cash Flow' },
]

export default function FundModelSchedule({ results }) {
  const [visibleColumns, setVisibleColumns] = useState({
    mgtFee: true,
    opex: true,
    orgFee: false,
    usCapitalDeployed: false,
    waCapitalDeployed: false,
    usDistributions: false,
    waDistributions: false,
    unrealizedFV: true,
    carryDeduction: true,
    taxDeduction: true,
    netCashFlow: true,
  })

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const formatCurrency = (val) => {
    const sign = val < 0 ? '-' : ''
    return `${sign}$${(Math.abs(val) / 1000000).toFixed(2)}M`
  }

  if (!results || !results.scheduleTable) {
    return <div className="p-6 text-gray-500">Configure the fund to see the annual schedule.</div>
  }

  const { scheduleTable, fundWaterfall } = results

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Fund Model — Annual Cash Flow Schedule</h2>
      <p className="text-sm text-gray-600 mb-4">
        Year-by-year view of capital deployment, fees, distributions, and NAV — showing exactly how the summary
        DPI and IRR were built up over the fund's life.
      </p>

      {/* Gross vs Net Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 uppercase">Gross IRR</p>
          <p className="text-xl font-bold text-blue-700">{(fundWaterfall.grossIRR * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Deal cash flows only</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 uppercase">Net IRR</p>
          <p className="text-xl font-bold text-purple-700">{(fundWaterfall.netIRR * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">After fees & carry drag</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 uppercase">GP Carry (final yr)</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(fundWaterfall.gpCarry)}</p>
        </div>
      </div>

      {/* Column Toggles */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Show additional columns:</p>
        <div className="flex flex-wrap gap-3">
          {OPTIONAL_COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded px-3 py-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleColumns[col.key]}
                onChange={() => toggleColumn(col.key)}
                className="h-4 w-4"
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white sticky top-0">
              <th className="p-3 text-left whitespace-nowrap">Year</th>
              <th className="p-3 text-left whitespace-nowrap">Capital Deployed</th>
              {visibleColumns.usCapitalDeployed && <th className="p-3 text-left whitespace-nowrap">US Deployed</th>}
              {visibleColumns.waCapitalDeployed && <th className="p-3 text-left whitespace-nowrap">WA Deployed</th>}
              {visibleColumns.mgtFee && <th className="p-3 text-left whitespace-nowrap">Mgt Fee</th>}
              {visibleColumns.opex && <th className="p-3 text-left whitespace-nowrap">OpEx</th>}
              {visibleColumns.orgFee && <th className="p-3 text-left whitespace-nowrap">Org Fee</th>}
              <th className="p-3 text-left whitespace-nowrap">Distributions</th>
              {visibleColumns.usDistributions && <th className="p-3 text-left whitespace-nowrap">US Dist.</th>}
              {visibleColumns.waDistributions && <th className="p-3 text-left whitespace-nowrap">WA Dist.</th>}
              {visibleColumns.unrealizedFV && <th className="p-3 text-left whitespace-nowrap">Unrealized FV</th>}
              {visibleColumns.carryDeduction && <th className="p-3 text-left whitespace-nowrap">GP Carry Deducted</th>}
              {visibleColumns.netCashFlow && <th className="p-3 text-left whitespace-nowrap">Net Cash Flow</th>}
              <th className="p-3 text-left whitespace-nowrap">Running AUM</th>
              <th className="p-3 text-left whitespace-nowrap">Cumulative Distributions</th>
            </tr>
          </thead>
          <tbody>
            {scheduleTable.map((row) => (
              <tr
                key={row.year}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  row.carryDeduction > 0 || row.taxDeduction > 0 ? 'bg-amber-50' : ''
                }`}
              >
                <td className="p-3 font-medium">{row.year}</td>
                <td className="p-3">{formatCurrency(row.capitalDeployed)}</td>
                {visibleColumns.usCapitalDeployed && <td className="p-3">{formatCurrency(row.usCapitalDeployed)}</td>}
                {visibleColumns.waCapitalDeployed && <td className="p-3">{formatCurrency(row.waCapitalDeployed)}</td>}
                {visibleColumns.mgtFee && <td className="p-3 text-red-600">{formatCurrency(-row.mgtFee)}</td>}
                {visibleColumns.opex && <td className="p-3 text-red-600">{formatCurrency(-row.opex)}</td>}
                {visibleColumns.orgFee && <td className="p-3 text-red-600">{formatCurrency(-row.orgFee)}</td>}
                <td className="p-3 text-green-600">{formatCurrency(row.distributions)}</td>
                {visibleColumns.usDistributions && (
                  <td className="p-3 text-green-600">{formatCurrency(row.usDistributions)}</td>
                )}
                {visibleColumns.waDistributions && (
                  <td className="p-3 text-green-600">{formatCurrency(row.waDistributions)}</td>
                )}
                {visibleColumns.unrealizedFV && (
                  <td className="p-3 text-blue-600">{formatCurrency(row.unrealizedFV)}</td>
                )}
                {visibleColumns.carryDeduction && (
                  <td className="p-3 text-red-700 font-medium">
                    {row.carryDeduction > 0 ? formatCurrency(-row.carryDeduction) : '—'}
                  </td>
                )}
                {visibleColumns.netCashFlow && (
                  <td className={`p-3 font-medium ${row.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(row.netCashFlow)}
                  </td>
                )}
                <td className="p-3 font-medium">{formatCurrency(row.runningAUM)}</td>
                <td className="p-3">{formatCurrency(row.cumulativeDistributions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        GP Carry is deducted as a lump sum in the fund's final year (highlighted row above) — this is a simplification;
        in practice carry can crystallize earlier per deal. "Unrealized FV" reflects mark-to-model value of deals still
        held, dropping to $0 the year a deal exits.
      </p>
    </div>
  )
}
