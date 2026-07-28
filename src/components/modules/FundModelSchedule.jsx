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

  const { scheduleTable } = results

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Fund Model — Annual Cash Flow Schedule</h2>
      <p className="text-sm text-gray-600 mb-6">
        Year-by-year view of capital deployment, fees, distributions, and NAV — showing exactly how the summary
        DPI and IRR were built up over the fund's life.
      </p>

      {/* Column Toggles */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Show additional columns:</p>
        <div className="flex flex-wrap gap-3">
          {OPTIONAL_COLUMNS.map((col) => (
            <label key={col.key} className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded px-3 py-1.5 cursor-pointer">
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
              {visibleColumns.netCashFlow && <th className="p-3 text-left whitespace-nowrap">Net Cash Flow</th>}
              <th className="p-3 text-left whitespace-nowrap">Running AUM</th>
              <th className="p-3 text-left whitespace-nowrap">Cumulative Distributions</th>
            </tr>
          </thead>
          <tbody>
            {scheduleTable.map((row) => (
              <tr key={row.year} className="border-b border-gray-100 hover:bg-gray-50">
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
                {visibleColumns.unrealizedFV && <td className="p-3 text-blue-600">{formatCurrency(row.unrealizedFV)}</td>}
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
        "Unrealized FV" reflects mark-to-model value of deals still held (accrued PIK/pref not yet cashed out, plus
        straight-line accrual toward exit MOIC on equity positions). It drops to $0 for a deal in the year it exits,
        replaced by the realized distribution.
      </p>
    </div>
  )
}
