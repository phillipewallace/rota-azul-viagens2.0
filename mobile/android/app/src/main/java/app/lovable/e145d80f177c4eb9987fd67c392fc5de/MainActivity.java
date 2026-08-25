package app.lovable.e145d80f177c4eb9987fd67c392fc5de;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity para o app Alchemy Rotas
 * 
 * Funcionalidades de Deep Link:
 * - Recebe localizações compartilhadas do WhatsApp/Google Maps
 * - Passa os dados para o React via query parameters na URL inicial
 * - Funciona tanto quando o app é aberto (onCreate) quanto em background (onNewIntent)
 */
public class MainActivity extends BridgeActivity {
  
  private static final String TAG = "AlchemyRotas";
  private String pendingLocationUri = null;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    // Processar intent inicial
    Intent intent = getIntent();
    if (intent != null) {
      processIntent(intent);
    }
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    
    if (intent != null) {
      processIntent(intent);
    }
  }
  
  @Override
  public void onResume() {
    super.onResume();
    
    // Se temos uma localização pendente, injetar no WebView
    if (pendingLocationUri != null && getBridge() != null) {
      injectLocationToWebView(pendingLocationUri);
      pendingLocationUri = null;
    }
  }

  /**
   * Processa intents de localização (ACTION_VIEW com geo: ou maps URLs)
   * e compartilhamentos de texto (ACTION_SEND)
   */
  private void processIntent(Intent intent) {
    String action = intent.getAction();
    String type = intent.getType();
    Uri data = intent.getData();

    Log.d(TAG, "📱 processIntent - action: " + action + ", type: " + type + ", data: " + data);

    // Compartilhamento de texto (geralmente links do WhatsApp)
    if (Intent.ACTION_SEND.equals(action) && type != null && "text/plain".equals(type)) {
      String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (sharedText != null && !sharedText.isEmpty()) {
        Log.d(TAG, "📍 Texto compartilhado recebido: " + sharedText);
        handleLocationData(sharedText);
      }
    }
    // Abertura de URL de localização (geo:, maps, etc)
    else if (Intent.ACTION_VIEW.equals(action) && data != null) {
      String uriString = data.toString();
      Log.d(TAG, "📍 URI de localização recebida: " + uriString);
      handleLocationData(uriString);
    }
  }

  /**
   * Processa e passa os dados de localização para o WebView
   */
  private void handleLocationData(String locationData) {
    if (locationData == null || locationData.isEmpty()) {
      return;
    }

    Log.d(TAG, "🔄 Processando dados de localização: " + locationData);

    // Guardar para quando o WebView estiver pronto
    pendingLocationUri = locationData;

    // Se o bridge já está disponível, injetar imediatamente
    if (getBridge() != null && getBridge().getWebView() != null) {
      injectLocationToWebView(locationData);
      pendingLocationUri = null;
    }
  }

  /**
   * Injeta os dados de localização no WebView via JavaScript
   * Isso permite que o React receba os dados independente do ciclo de vida
   */
  private void injectLocationToWebView(String locationData) {
    if (getBridge() == null || getBridge().getWebView() == null) {
      Log.e(TAG, "❌ Bridge ou WebView não disponível");
      return;
    }

    // Escapar aspas e caracteres especiais para JavaScript
    String escapedData = locationData
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r");

    // JavaScript para notificar o React sobre a localização recebida
    String jsCode = String.format(
      "try {" +
      "  console.log('📱 [ANDROID] Localização recebida do intent:', '%s');" +
      "  if (window.handleAndroidSharedLocation) {" +
      "    window.handleAndroidSharedLocation('%s');" +
      "  } else {" +
      "    window.pendingSharedLocation = '%s';" +
      "    console.log('📱 [ANDROID] Localização salva em window.pendingSharedLocation');" +
      "  }" +
      "  window.dispatchEvent(new CustomEvent('sharedLocation', { detail: '%s' }));" +
      "} catch(e) { console.error('Erro ao processar localização:', e); }",
      escapedData, escapedData, escapedData, escapedData
    );

    Log.d(TAG, "📤 Injetando JavaScript no WebView");

    // Executar na UI thread
    runOnUiThread(() -> {
      getBridge().getWebView().evaluateJavascript(jsCode, (result) -> {
        Log.d(TAG, "✅ JavaScript executado, resultado: " + result);
      });
    });
  }
}