'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    employee_id: '',
    name: '',
    department: '',
    sr_name: '',
    channel: '',
    branch_name: '',
    position: '',
    hire_date: '',
    birth_date: '',
    phone: '',
    email: '',
    role: 'USER',
    status: 'ACTIVE'
  })

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, roleFilter])

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('employee_id')
    
    if (data) {
      setUsers(data)
    }
    setLoading(false)
  }

  const filterUsers = () => {
    let filtered = users

    // role 필터
    if (roleFilter !== 'ALL') {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    // 검색 필터
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.employee_id?.includes(searchTerm) ||
        user.name?.includes(searchTerm) ||
        user.department?.includes(searchTerm) ||
        user.sr_name?.includes(searchTerm) ||
        user.branch_name?.includes(searchTerm)
      )
    }

    setFilteredUsers(filtered)
    setCurrentPage(1)
  }

  const downloadUserList = () => {
    const excelData = filteredUsers.map(user => ({
      '사번': user.employee_id || '',
      '이름': user.name || '',
      '담당': user.department || '',
      'SR': user.sr_name || '',
      '채널': user.channel || '',
      '지점명': user.branch_name || '',
      '직책': user.position || '',
      '입사일': user.hire_date || '',
      '생년월일': user.birth_date || '',
      '연락처': user.phone || '',
      '이메일': user.email || '',
      '상태': user.status === 'ACTIVE' ? '재직' : user.status === 'LEAVE' ? '휴직' : '퇴사',
      '권한': user.role === 'SUPER_ADMIN' ? '관리자' : user.role === 'SR' ? 'SR' : '판매사원'
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '인원목록')

    const fileName = `인원목록_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const handleAdd = async () => {
    if (!addForm.employee_id || !addForm.name) {
      alert('사번과 이름은 필수입니다.')
      return
    }

    const { error } = await supabase
      .from('users')
      .insert({
        employee_id: addForm.employee_id,
        name: addForm.name,
        department: addForm.department,
        sr_name: addForm.sr_name,
        channel: addForm.channel,
        branch_name: addForm.branch_name,
        position: addForm.position,
        hire_date: addForm.hire_date || null,
        birth_date: addForm.birth_date || null,
        phone: addForm.phone,
        email: addForm.email,
        role: addForm.role,
        status: addForm.status
      })

    if (error) {
      alert('등록 실패: ' + error.message)
    } else {
      alert('등록 완료!')
      setShowAddForm(false)
      setAddForm({
        employee_id: '',
        name: '',
        department: '',
        sr_name: '',
        channel: '',
        branch_name: '',
        position: '',
        hire_date: '',
        birth_date: '',
        phone: '',
        email: '',
        role: 'USER',
        status: 'ACTIVE'
      })
      loadUsers()
    }
  }

  const handleEdit = (user) => {
    setEditingId(user.id)
    setEditForm({ ...user })
  }

  const handleUpdate = async (userId) => {
    if (!editForm.employee_id || !editForm.name) {
      alert('사번과 이름은 필수입니다.')
      return
    }

    const { error } = await supabase
      .from('users')
      .update({
        employee_id: editForm.employee_id,
        name: editForm.name,
        department: editForm.department,
        sr_name: editForm.sr_name,
        channel: editForm.channel,
        branch_name: editForm.branch_name,
        position: editForm.position,
        hire_date: editForm.hire_date || null,
        birth_date: editForm.birth_date || null,
        phone: editForm.phone,
        email: editForm.email,
        status: editForm.status,
        role: editForm.role
      })
      .eq('id', userId)

    if (error) {
      alert('수정 실패: ' + error.message)
    } else {
      alert('수정 완료!')
      setEditingId(null)
      setEditForm(null)
      loadUsers()
    }
  }

  const handleDelete = async (userId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      alert('삭제 완료!')
      loadUsers()
    }
  }

  const handleStatusChange = async (userId, newStatus) => {
    const { error } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', userId)

    if (!error) {
      loadUsers()
    }
  }
  const handleRoleChange = async (userId, newRole) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)

    if (!error) {
      loadUsers()
    }
  }
  // 페이지네이션
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)

  const paginate = (pageNumber) => setCurrentPage(pageNumber)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">👥 인원 목록</h2>

      {/* 상단 액션 */}
      <div className="flex gap-2 mb-4">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-1.5 border rounded text-sm"
        >
          <option value="ALL">전체</option>
          <option value="USER">판매사원</option>
          <option value="SR">SR</option>
          <option value="SUPER_ADMIN">관리자</option>
        </select>
        <input
          type="text"
          placeholder="사번/이름/담당/SR/지점 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-1.5 border rounded text-sm"
        />
        <button
          onClick={downloadUserList}
          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap text-sm"
        >
          📊 다운로드
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap text-sm"
        >
          {showAddForm ? '취소' : '+ 인원 추가'}
        </button>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-bold mb-3">신규 인원 등록</h3>
          <div className="grid grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="사번 *"
              value={addForm.employee_id}
              onChange={(e) => setAddForm({...addForm, employee_id: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="이름 *"
              value={addForm.name}
              onChange={(e) => setAddForm({...addForm, name: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="담당"
              value={addForm.department}
              onChange={(e) => setAddForm({...addForm, department: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="SR"
              value={addForm.sr_name}
              onChange={(e) => setAddForm({...addForm, sr_name: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="채널"
              value={addForm.channel}
              onChange={(e) => setAddForm({...addForm, channel: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="지점명"
              value={addForm.branch_name}
              onChange={(e) => setAddForm({...addForm, branch_name: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="직책"
              value={addForm.position}
              onChange={(e) => setAddForm({...addForm, position: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="date"
              placeholder="입사일"
              value={addForm.hire_date}
              onChange={(e) => setAddForm({...addForm, hire_date: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="date"
              placeholder="생년월일"
              value={addForm.birth_date}
              onChange={(e) => setAddForm({...addForm, birth_date: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="text"
              placeholder="연락처"
              value={addForm.phone}
              onChange={(e) => setAddForm({...addForm, phone: e.target.value})}
              className="px-3 py-2 border rounded"
            />
            <input
              type="email"
              placeholder="이메일"
              value={addForm.email}
              onChange={(e) => setAddForm({...addForm, email: e.target.value})}
              className="px-3 py-2 border rounded col-span-2"
            />
            <select
              value={addForm.role}
              onChange={(e) => setAddForm({...addForm, role: e.target.value})}
              className="px-3 py-2 border rounded"
            >
              <option value="USER">판매사원</option>
              <option value="SR">SR</option>
              <option value="SUPER_ADMIN">관리자</option>
            </select>
            <select
              value={addForm.status}
              onChange={(e) => setAddForm({...addForm, status: e.target.value})}
              className="px-3 py-2 border rounded"
            >
              <option value="ACTIVE">재직</option>
              <option value="LEAVE">휴직</option>
              <option value="INACTIVE">퇴사</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            등록
          </button>
        </div>
      )}

      {/* 통계 */}
      <div className="mb-4 text-sm text-gray-600">
        전체: {users.length}명 | 검색 결과: {filteredUsers.length}명 | 
        현재 페이지: {currentUsers.length}명
      </div>

      {/* 테이블 */}
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-2 text-center">담당</th>
                  <th className="border px-2 py-2 text-center">SR</th>
                  <th className="border px-2 py-2 text-center">채널</th>
                  <th className="border px-2 py-2 text-center">지점</th>
                  <th className="border px-2 py-2 text-center">직책</th>
                  <th className="border px-2 py-2 text-center">사번</th>
                  <th className="border px-2 py-2 text-center">이름</th>
                  <th className="border px-2 py-2 text-center">입사일</th>
                  <th className="border px-2 py-2 text-center">연락처</th>
                  <th className="border px-2 py-2 text-center">상태</th>
                  <th className="border px-2 py-2 text-center">권한</th>
                  <th className="border px-2 py-2 text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map((user) => (
                  editingId === user.id ? (
                    <tr key={user.id} className="bg-yellow-50">
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.department || ''}
                          onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.sr_name || ''}
                          onChange={(e) => setEditForm({...editForm, sr_name: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.channel || ''}
                          onChange={(e) => setEditForm({...editForm, channel: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.branch_name || ''}
                          onChange={(e) => setEditForm({...editForm, branch_name: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.position || ''}
                          onChange={(e) => setEditForm({...editForm, position: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.employee_id}
                          onChange={(e) => setEditForm({...editForm, employee_id: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="date"
                          value={editForm.hire_date || ''}
                          onChange={(e) => setEditForm({...editForm, hire_date: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <input
                          type="text"
                          value={editForm.phone || ''}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs text-center"
                        />
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs"
                        >
                          <option value="ACTIVE">재직</option>
                          <option value="LEAVE">휴직</option>
                          <option value="INACTIVE">퇴사</option>
                        </select>
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                          className="w-full px-2 py-1 border rounded text-xs"
                        >
                          <option value="USER">판매사원</option>
                          <option value="SR">SR</option>
                          <option value="SUPER_ADMIN">관리자</option>
                        </select>
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleUpdate(user.id)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null)
                              setEditForm(null)
                            }}
                            className="px-2 py-1 bg-gray-400 text-white rounded text-xs"
                          >
                            취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="border px-2 py-2 text-center">{user.department || '-'}</td>
                      <td className="border px-2 py-2 text-center">{user.sr_name || '-'}</td>
                      <td className="border px-2 py-2 text-center">{user.channel || '-'}</td>
                      <td className="border px-2 py-2 text-center">{user.branch_name || '-'}</td>
                      <td className="border px-2 py-2 text-center">{user.position || '-'}</td>
                      <td className="border px-2 py-2 text-center">{user.employee_id}</td>
                      <td className="border px-2 py-2 text-center">{user.name}</td>
                      <td className="border px-2 py-2 text-center">{user.hire_date || '-'}</td>
                      <td className="border px-2 py-2 text-center">{user.phone || '-'}</td>
                      <td className="border px-2 py-2 text-center">
                        <select
                          value={user.status}
                          onChange={(e) => handleStatusChange(user.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs border-0 cursor-pointer ${
                            user.status === 'ACTIVE' 
                              ? 'bg-green-100 text-green-800' 
                              : user.status === 'LEAVE'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <option value="ACTIVE">재직</option>
                          <option value="LEAVE">휴직</option>
                          <option value="INACTIVE">퇴사</option>
                        </select>
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs border-0 cursor-pointer ${
                            user.role === 'SUPER_ADMIN' 
                              ? 'bg-red-100 text-red-800'
                              : user.role === 'SR'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <option value="USER">판매사원</option>
                          <option value="SR">SR</option>
                          <option value="SUPER_ADMIN">관리자</option>
                        </select>
                      </td>
                      <td className="border px-2 py-2 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                이전
              </button>
              
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => paginate(pageNum)}
                      className={`px-3 py-1 border rounded ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                } else if (
                  pageNum === currentPage - 3 ||
                  pageNum === currentPage + 3
                ) {
                  return <span key={pageNum}>...</span>
                }
                return null
              })}

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                다음
              </button>
            </div>
          )}

          {currentUsers.length === 0 && (
            <p className="text-center py-8 text-gray-500">검색 결과가 없습니다.</p>
          )}
        </>
      )}
    </div>
  )
}