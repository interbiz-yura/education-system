'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export default function ScoreManagement() {
  const [scoreType, setScoreType] = useState('RP')
  const [yearMonth, setYearMonth] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const scoreTypes = [
    { value: 'RP', label: 'R/P 점수', max: 100 },
    { value: 'SALES_TALK', label: '세일즈톡 TEST', max: 100 },
    { value: 'COMPETENCY_TEST', label: '역량강화 TEST', max: 10 }
  ]

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    setMessage('')
    setPreview([])

    if (selectedFile) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet)
        setPreview(jsonData.slice(0, 5))
      }
      reader.readAsArrayBuffer(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file || !yearMonth) {
      setMessage('파일과 년월을 모두 선택해주세요.')
      return
    }
    setLoading(true)
    setMessage('')

    const reader = new FileReader()
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)

      let successCount = 0
      let errorCount = 0

      for (const row of jsonData) {
        const employeeId = String(row['사번'] || row['ID'] || '')
        const score = parseFloat(row['점수'] || row['score'] || 0)

        if (!employeeId) {
          errorCount++
          continue
        }

        // 사번으로 user_id 찾기
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('employee_id', employeeId)
          .single()

        if (!userData) {
          errorCount++
          continue
        }

        const { error } = await supabase
          .from('scores')
          .upsert({
            user_id: userData.id,
            score_type: scoreType,
            year_month: yearMonth,
            score: score
          }, { onConflict: 'user_id,score_type,year_month' })

        if (error) {
          errorCount++
        } else {
          successCount++
        }
      }

      setMessage(`완료! 성공: ${successCount}건, 실패: ${errorCount}건`)
      setLoading(false)
      setFile(null)
      setPreview([])
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">📊 점수 업로드</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">점수 종류</label>
          <select
            value={scoreType}
            onChange={(e) => setScoreType(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {scoreTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label} (0~{t.max})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">년월</label>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="mb-4 p-4 bg-gray-50 rounded text-sm">
        <p className="font-semibold mb-2">엑셀 컬럼 형식:</p>
        <p className="text-gray-600">사번 | 점수</p>
        <p className="text-xs text-gray-400 mt-1">* 컬럼명: 사번(또는 ID), 점수(또는 score)</p>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      {preview.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <p className="text-sm font-semibold mb-2">미리보기 (상위 5행):</p>
          <table className="min-w-full text-xs border">
            <thead className="bg-gray-100">
              <tr>
                {Object.keys(preview[0]).map((key) => (
                  <th key={key} className="border px-2 py-1">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="border px-2 py-1">{String(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={loading || !file || !yearMonth}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
      >
        {loading ? '업로드 중...' : '업로드 및 적용'}
      </button>

      {message && (
        <p className={`mt-4 font-semibold ${message.includes('실패') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}