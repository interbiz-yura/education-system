'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function UserManagement({ onBack }) {
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name')
    
    if (data) setUsers(data)
    setLoading(false)
  }

  const updateRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
    
    if (error) {
      setMessage('권한 변경 실패: ' + error.message)
    } else {
      setMessage('권한이 변경되었습니다.')
      loadUsers()
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const updateStatus = async (userId, newStatus) => {
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', userId)
    
    if (error) {
      setMessage('상태 변경 실패: ' + error.message)
    } else {
      setMessage('상태가 변경되었습니다.')
      loadUsers()
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const filteredUsers = users.filter(user => {
    const matchesFilter = 
      filter === 'ALL' ||
      (filter === 'ACTIVE' && user.status === 'ACTIVE') ||
      (filter === 'INACTIVE' && user.status === 'INACTIVE') ||
      (filter === 'ADMIN' && user.role === 'SUPER_ADMIN') ||
      (filter === 'MANAGER' && user.role === 'MANAGER')
    
    const matchesSearch = 
      search === '' ||
      user.name?.includes(search) ||
      user.employee_id?.includes(search) ||
      user.branch_name?.includes(search)
    
    return matchesFilter && matchesSearch
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">👥 인원 관리</h2>
        <span className="text-sm text-gray-500">총 {users.length}명</span>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">
          {message}
        </div>
      )}

      {/* 필터 & 검색 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="ALL">전체</option>
          <option value="ACTIVE">재직자</option>
          <option value="INACTIVE">퇴사자</option>
          <option value="ADMIN">관리자</option>
          <option value="MANAGER">SR</option>
        </select>
        <input
          type="text"
          placeholder="이름/사번/지점 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
      </div>

      {/* 인원 목록 */}
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">사번</th>
                <th className="px-3 py-2 text-left">지점</th>
                <th className="px-3 py-2 text-left">채널</th>
                <th className="px-3 py-2 text-left">권한</th>
                <th className="px-3 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`border-b ${user.status === 'INACTIVE' ? 'bg-gray-50 text-gray-400' : ''}`}>
                  <td className="px-3 py-2 font-medium">{user.name}</td>
                  <td className="px-3 py-2">{user.employee_id}</td>
                  <td className="px-3 py-2">{user.branch_name}</td>
                  <td className="px-3 py-2">{user.channel}</td>
                  <td className="px-3 py-2">
                    <select
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      className={`border rounded px-2 py-1 text-xs ${
                        user.role === 'SUPER_ADMIN' ? 'bg-red-100' : 
                        user.role === 'MANAGER' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                    >
                      <option value="USER">매니저</option>
                      <option value="MANAGER">SR</option>
                      <option value="SUPER_ADMIN">관리자</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={user.status}
                      onChange={(e) => updateStatus(user.id, e.target.value)}
                      className={`border rounded px-2 py-1 text-xs ${
                        user.status === 'ACTIVE' ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      <option value="ACTIVE">재직</option>
                      <option value="INACTIVE">퇴사</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && (
            <p className="text-center py-4 text-gray-500">검색 결과가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}