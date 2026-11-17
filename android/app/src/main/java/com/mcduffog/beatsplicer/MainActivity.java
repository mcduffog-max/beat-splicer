package com.mcduffog.beatsplicer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class); // the in-app "Update app" button
        super.onCreate(savedInstanceState);
    }
}
