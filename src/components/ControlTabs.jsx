import React from 'react'

const TABS = [
  { id: 'fund-fees', label: 'Fund Overview & Fees' },
  { id: 'us-deals', label: 'US Search Deals' },
  { id: 'wa-deals', label: 'West Africa Deals' },
  { id: 'sensitivity', label: 'Sensitivity Matrix' },
]

export default function ControlTabs({ activeTab, setActiveTab }) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex space-x-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
