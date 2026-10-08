# Framework examples

These components are copied into an existing app after `npm install seamplayer`.

- `astro/Player.astro`: SSR poster and a browser custom element. No React integration or client hydration directive is required.
- `svelte/Player.svelte`: Svelte 5 with SSR-safe browser registration and rich properties. For Svelte 4, use `onMount` to set properties and update them with `$:`.
- `expo/SeamPlayerDOM.tsx` and `WatchScreen.tsx`: Expo DOM component and its native host. Keep the `"use dom"` directive in your app's source file so Expo can split the bundle. Expo SDK 55 and earlier require `npx expo install react-native-webview`; SDK 56+ provides the default DOM webview. See [Expo's DOM guide](https://docs.expo.dev/guides/dom-components/).

Expo runs the web player in a webview. Fullscreen, picture-in-picture, downloads, and clipboard behavior depend on the platform and webview configuration; test them on your target devices. This is not an `expo-video` native implementation.
