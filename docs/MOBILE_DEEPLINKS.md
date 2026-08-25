# Capacitor Deeplinks — referência rápida

> Este projeto **não versiona** a pasta `android/` (ela é gerada por
> `npx cap add android` localmente após o Export to GitHub).
> Use este documento como referência ao configurar a camada nativa.

## Regra crítica

Injeção de dados via deeplink **DEVE** usar `evaluateJavascript()` no
`MainActivity`. O padrão antigo com `getBridge().triggerJSEvent(...)`
foi descontinuado e quebra em versões recentes do Capacitor.

## AndroidManifest.xml

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask"
    android:configChanges="keyboardHidden|orientation|screenSize">
    <!-- Launcher -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- Deeplink alchemyrotas://route/... -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="alchemyrotas" />
    </intent-filter>
</activity>
```

## MainActivity.java — padrão correto

```java
@Override
public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);

    Uri data = intent.getData();
    if (data == null) return;

    // Repasse para o JS via evaluateJavascript (NUNCA getBridge().triggerJSEvent)
    String url = data.toString().replace("'", "\\'");
    String js = "window.dispatchEvent(new CustomEvent('alchemy:deeplink', " +
                "{ detail: { url: '" + url + "' } }));";

    runOnUiThread(() -> {
        WebView webView = this.bridge.getWebView();
        webView.evaluateJavascript(js, null);
    });
}
```

## Lado JS — receptor

```ts
useEffect(() => {
  const handler = (e: Event) => {
    const { url } = (e as CustomEvent<{ url: string }>).detail;
    // parse e roteamento aqui
  };
  window.addEventListener('alchemy:deeplink', handler);
  return () => window.removeEventListener('alchemy:deeplink', handler);
}, []);
```

## Checklist ao gerar `android/`

- [ ] `intent-filter` para o scheme do app
- [ ] `launchMode="singleTask"` na MainActivity
- [ ] `onNewIntent` salvando o novo intent com `setIntent(intent)`
- [ ] Injeção via `webView.evaluateJavascript(...)`
- [ ] `runOnUiThread` para a chamada
- [ ] Escape de aspas simples na URL antes de injetar
