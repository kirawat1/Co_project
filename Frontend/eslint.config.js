import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },

    rules: {
      // ใช้ notify / askConfirm จาก src/utils/notify.ts แทนกล่องของเบราว์เซอร์
      'no-alert': 'error',
      // ตัด field ออกด้วย destructuring ({ a: _a, ...rest }) / พารามิเตอร์ที่ขึ้นต้นด้วย _ ไม่นับว่าไม่ได้ใช้
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // ยังมี `any` เดิมราว 200 จุด และไฟล์ที่ export ค่าคู่กับ component — เตือนไว้ ค่อยทยอยแก้ (ดู README "งานที่พัฒนาต่อได้")
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
