# Step 6: Expo Mobile App Setup

## Overview
Create Android and iOS apps for DigiClassroom Pro using Expo/React Native with maximum code sharing from your existing Next.js codebase.

---

## 6.1 Install Expo CLI

```bash
npm install -g expo-cli eas-cli
```

---

## 6.2 Create Monorepo Structure

```
DigiClassroom-Pro/
├── apps/
│   ├── web/                    # Existing Next.js app (move src/ here)
│   └── mobile/                 # New Expo app
├── packages/
│   ├── shared/                 # Shared components & logic
│   ├── api/                    # tRPC client (shared)
│   └── ui/                     # Shared UI components
├── package.json               # Root workspace config
└── turbo.json                 # Turborepo config (optional)
```

### Initialize Expo App:
```bash
cd apps
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
```

---

## 6.3 Configure Expo for Your App

```json
// apps/mobile/app.json
{
  "expo": {
    "name": "DigiClassroom Pro",
    "slug": "digiclassroom-pro",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a1a2e"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.digiclassroom.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      },
      "package": "com.digiclassroom.app",
      "permissions": ["INTERNET", "CAMERA", "READ_EXTERNAL_STORAGE"]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

---

## 6.4 Install Essential Dependencies

```bash
cd apps/mobile

# Navigation
npx expo install expo-router react-native-screens react-native-safe-area-context

# UI Components
npm install nativewind
npm install --save-dev tailwindcss

# API & State
npm install @tanstack/react-query zustand
npm install @trpc/client @trpc/react-query

# Auth (Clerk)
npx expo install @clerk/clerk-expo expo-secure-store

# Storage
npx expo install @react-native-async-storage/async-storage

# Utilities
npx expo install expo-constants expo-linking
```

---

## 6.5 Share tRPC Client

```typescript
// packages/api/src/client.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../web/src/server/routers';

export const trpc = createTRPCReact<AppRouter>();

// Provider wrapper
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${API_URL}/api/trpc`,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

## 6.6 Mobile App Structure

```
apps/mobile/
├── app/                           # Expo Router pages
│   ├── (auth)/                    # Auth screens
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/                    # Main tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx              # Home/Dashboard
│   │   ├── tutor.tsx              # AI Tutor
│   │   ├── materials.tsx          # Study Materials
│   │   └── profile.tsx            # User Profile
│   ├── _layout.tsx                # Root layout
│   └── index.tsx                  # Entry point
├── components/                    # Mobile-specific components
├── hooks/                         # Custom hooks
├── lib/                           # Utilities
└── assets/                        # Images, fonts
```

---

## 6.7 Example Screen (AI Tutor)

```tsx
// apps/mobile/app/(tabs)/tutor.tsx
import { View, TextInput, FlatList, Text } from 'react-native';
import { useState } from 'react';
import { trpc } from '@packages/api';

export default function AITutorScreen() {
  const [query, setQuery] = useState('');
  const askMutation = trpc.tutor.ask.useMutation();
  const { data: history } = trpc.chat.getHistory.useQuery();

  const handleAsk = async () => {
    if (!query.trim()) return;
    await askMutation.mutateAsync({ question: query });
    setQuery('');
  };

  return (
    <View className="flex-1 bg-gray-900 p-4">
      <FlatList
        data={history}
        renderItem={({ item }) => (
          <View className="p-3 mb-2 bg-gray-800 rounded-lg">
            <Text className="text-white">{item.content}</Text>
          </View>
        )}
      />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Ask a question..."
        className="bg-gray-800 text-white p-4 rounded-lg"
        onSubmitEditing={handleAsk}
      />
    </View>
  );
}
```

---

## 6.8 Set Up EAS Build

```bash
# Login to Expo
eas login

# Configure EAS
eas build:configure

# Create eas.json
```

```json
// apps/mobile/eas.json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "resourceClass": "m-medium"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "production"
      },
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "your-app-id"
      }
    }
  }
}
```

---

## 6.9 Build & Submit

```bash
# Build Android APK (for testing)
eas build --platform android --profile preview

# Build production Android (AAB for Play Store)
eas build --platform android --profile production

# Build iOS
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

---

## 6.10 OTA Updates (Instant Updates)

```bash
# Configure updates
npx expo install expo-updates

# Publish update (after code changes)
eas update --branch production --message "Bug fixes"
```

Users get updates **instantly** without app store review!

---

## ✅ Verification Checklist

- [ ] Expo project created
- [ ] Monorepo structure set up
- [ ] Shared packages configured
- [ ] tRPC client working
- [ ] Navigation implemented
- [ ] EAS Build configured
- [ ] Test build successful

---

## 💰 Pricing

| Service | Cost |
|---------|------|
| Expo/EAS Free | 30 builds/month |
| Expo EAS Production | $99/year (unlimited) |
| Play Store | $25 one-time |
| App Store | $99/year |

---

## Next Step
→ [Step 7: CI/CD Workflow](./07-cicd-workflow.md)
