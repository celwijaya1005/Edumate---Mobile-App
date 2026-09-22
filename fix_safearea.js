const fs = require('fs');
const path = require('path');

const files = [
  'app/(auth)/login.tsx',
  'app/(auth)/mentor-processing.tsx',
  'app/(auth)/mentor-registration.tsx',
  'app/(auth)/register.tsx',
  'app/(tabs)/explore.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/mentor.tsx',
  'app/(tabs)/profile.tsx',
  'app/booking/[id].tsx',
  'app/mentors/[id].tsx',
  'app/modules/[id].tsx',
  'app/quiz/[id].tsx'
];

files.forEach(file => {
  const filePath = path.join('d:/APP EDUMATE/edumate-app', file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Only process if it imports SafeAreaView from react-native
  if (content.includes("from 'react-native-safe-area-context'")) {
      return;
  }

  // 1. Add the new import after the first import (or at top)
  content = `import { SafeAreaView } from 'react-native-safe-area-context';\n` + content;

  // 2. Remove SafeAreaView from react-native import block
  // We look for 'SafeAreaView,' or 'SafeAreaView' inside the react-native import
  // A simple way is to replace 'SafeAreaView,' with '' and 'SafeAreaView' with '' ONLY inside the import block
  
  // Find the react-native import block
  const rnImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-native['"]/s;
  const match = content.match(rnImportRegex);
  
  if (match) {
      let importsList = match[1];
      // Split by comma, remove SafeAreaView, join back
      let importsArray = importsList.split(',').map(s => s.trim()).filter(s => s !== 'SafeAreaView' && s !== '');
      let newImportsList = '\n  ' + importsArray.join(',\n  ') + '\n';
      
      let newImportBlock = `import {${newImportsList}} from 'react-native'`;
      content = content.replace(rnImportRegex, newImportBlock);
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
  }
});
