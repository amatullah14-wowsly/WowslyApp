import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

/*
  Custom Toast Configuration
  Matches Wowsly App Theme (Orange/White)
*/

export const toastConfig: ToastConfig = {
    success: (props) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#FF8A3C', backgroundColor: '#FFF', borderLeftWidth: 6 }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#1F1F1F'
            }}
            text2Style={{
                fontSize: 14,
                color: '#807A74'
            }}
        />
    ),
    error: (props) => (
        <ErrorToast
            {...props}
            style={{ borderLeftColor: '#E74C3C', backgroundColor: '#FFF', borderLeftWidth: 6 }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#1F1F1F'
            }}
            text2Style={{
                fontSize: 14,
                color: '#807A74'
            }}
        />
    ),
    info: (props) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#3498DB', backgroundColor: '#FFF', borderLeftWidth: 6 }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#1F1F1F'
            }}
            text2Style={{
                fontSize: 14,
                color: '#807A74'
            }}
        />
    )
};
