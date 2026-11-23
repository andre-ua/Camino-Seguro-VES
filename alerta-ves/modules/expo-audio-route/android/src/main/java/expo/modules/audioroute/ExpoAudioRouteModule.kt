package expo.modules.audioroute

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAudioRouteModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAudioRoute")

    // Devuelve "wired", "bluetooth" o "none"
    Function("getRoute") {
      currentRoute()
    }
  }

  private fun currentRoute(): String {
    val ctx = appContext.reactContext ?: return "none"
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    var route = "none"
    for (d in am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
      when (d.type) {
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_USB_HEADSET -> return "wired"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> route = "bluetooth"
        else -> {
          if (Build.VERSION.SDK_INT >= 31 && d.type == AudioDeviceInfo.TYPE_BLE_HEADSET) {
            route = "bluetooth"
          }
        }
      }
    }
    return route
  }
}
