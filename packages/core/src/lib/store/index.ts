import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User, Class, UserRole } from '@/lib/validations'

// User store interface
interface UserState {
  currentUser: User | null
  userRole: UserRole | null
  tenantId: string | null
  preferences: Record<string, any>
  
  // Actions
  setCurrentUser: (user: User) => void
  setUserRole: (role: UserRole) => void
  setTenantId: (tenantId: string) => void
  updatePreferences: (preferences: Record<string, any>) => void
  clearUser: () => void
}

// Classes store interface
interface ClassesState {
  classes: Class[]
  selectedClass: Class | null
  isLoading: boolean
  
  // Actions
  setClasses: (classes: Class[]) => void
  setSelectedClass: (classData: Class) => void
  addClass: (classData: Class) => void
  updateClass: (classId: string, updates: Partial<Class>) => void
  removeClass: (classId: string) => void
  setLoading: (loading: boolean) => void
}

// UI store interface
interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: Date
  }>
  
  // Actions
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

// Create user store
export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        currentUser: null,
        userRole: null,
        tenantId: null,
        preferences: {},

        setCurrentUser: (user) => {
          set({ currentUser: user })
        },

        setUserRole: (role) => {
          set({ userRole: role })
        },

        setTenantId: (tenantId) => {
          set({ tenantId })
        },

        updatePreferences: (preferences) => {
          set((state) => ({
            preferences: { ...state.preferences, ...preferences }
          }))
        },

        clearUser: () => {
          set({
            currentUser: null,
            userRole: null,
            tenantId: null,
            preferences: {},
          })
        },
      }),
      {
        name: 'user-store',
      }
    ),
    { name: 'UserStore' }
  )
)

// Create classes store
export const useClassesStore = create<ClassesState>()(
  devtools(
    (set) => ({
      classes: [],
      selectedClass: null,
      isLoading: false,

      setClasses: (classes) => {
        set({ classes })
      },

      setSelectedClass: (classData) => {
        set({ selectedClass: classData })
      },

      addClass: (classData) => {
        set((state) => ({
          classes: [...state.classes, classData]
        }))
      },

      updateClass: (classId, updates) => {
        set((state) => ({
          classes: state.classes.map(cls =>
            cls.id === classId ? { ...cls, ...updates } : cls
          )
        }))
      },

      removeClass: (classId) => {
        set((state) => ({
          classes: state.classes.filter(cls => cls.id !== classId)
        }))
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },
    }),
    { name: 'ClassesStore' }
  )
)

// Create UI store
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: false,
        theme: 'system',
        notifications: [],

        toggleSidebar: () => {
          set((state) => ({ sidebarOpen: !state.sidebarOpen }))
        },

        setSidebarOpen: (open) => {
          set({ sidebarOpen: open })
        },

        setTheme: (theme) => {
          set({ theme })
        },

        addNotification: (notification) => {
          const id = Math.random().toString(36).substr(2, 9)
          const newNotification = {
            ...notification,
            id,
            timestamp: new Date(),
          }
          set((state) => ({
            notifications: [...state.notifications, newNotification]
          }))
        },

        removeNotification: (id) => {
          set((state) => ({
            notifications: state.notifications.filter(n => n.id !== id)
          }))
        },

        clearNotifications: () => {
          set({ notifications: [] })
        },
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          theme: state.theme,
        }),
      }
    ),
    { name: 'UIStore' }
  )
)

// Utility hook for notifications
export const useNotification = () => {
  const addNotification = useUIStore((state) => state.addNotification)
  const removeNotification = useUIStore((state) => state.removeNotification)
  
  return {
    addNotification,
    removeNotification,
  }
}

// Reset all stores (for logout, etc.)
export const resetAllStores = () => {
  useUserStore.getState().clearUser()
  useClassesStore.getState().setClasses([])
  useUIStore.getState().clearNotifications()
}
