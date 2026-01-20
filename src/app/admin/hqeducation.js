'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export default function HQEducationManagement() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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

  const parseBeseLevel = (value) => {
    if (!value) return 0
    const str = String(value).toLowerCase()
    if (str.includes('dc') || str.includes('검정')) return 4
    if (str.includes('판매스킬') || str.includes('스킬')) return 3
    if (str.includes('심화')) return 2
    if (str.includes('기본')) return 1
    return 0
  }

  const parseBoolean = (value) => {
    if (!value) return false
    const str = String(value).toLowerCase()
    return str === '이수' || str === 'o' || str === 'yes' || str === 'y' || str === '1' || str === 'true'
  }

  const handleUpload = async () => {
    if (!file) {
      setMessage('파일을 선택해주세요.')
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
          .from('hq_education_progress')
          .upsert({
            user_id: userData.id,
            bese_level: parseBeseLevel(row['베세'] || row['베세과정']),
            sales_up: parseBoolean(row['세일즈업']),
            pc_sales: parseBoolean(row['PC판매사'])
          }, { onConflict: 'user_id' })

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
      <h2 className="text-xl font-bold mb-4">🎓 본부교육 이수현황 업로드</h2>

      <div className="mb-4 p-4 bg-gray-50 rounded text-sm">
        <p className="font-semibold mb-2">엑셀 컬럼 형식:</p>
        <p className="text-gray-600">사번 | 베세 | 세일즈업 | PC판매사</p>
        <div className="mt-2 text-xs text-gray-500">
          <p>• 베세: 미이수, 기본, 심화, 판매스킬, DC검정</p>
          <p>• 세일즈업/PC판매사: 이수, 미이수 (또는 O, X)</p>
        </div>
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
        disabled={loading || !file}
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