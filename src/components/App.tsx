// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2024, Tiny Tapeout LTD

/// <reference types="dom-serial" />

import { CssBaseline, Stack, ThemeProvider, Typography } from '@suid/material';
import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { TTBoardDevice } from '~/ttcontrol/TTBoardDevice';
import { theme } from '~/utils/theme';
import { Main } from './Main';
import { Footer } from './Footer';
import { Header } from './Header';
import { LoadingButton } from './LoadingButton';

export function App() {
  const [supported, setSupported] = createSignal(false);
  const [breakoutDevice, setBreakoutDevice] = createSignal<TTBoardDevice | null>(null);
  const [connecting, setConnecting] = createSignal(false);
  const [connectError, setConnectError] = createSignal<Error | null>(null);
  const [firmwareUpdateRequired, setFirmwareUpdateRequired] = createSignal(false);
  const [unsupportedVersion, setUnsupportedVersion] = createSignal<string | null>(null);

  const connect = async () => {
    setConnecting(true);
    setUnsupportedVersion(null);
    try {
      const port = await navigator.serial.requestPort({
        filters: [{ usbVendorId: 0x2e8a, usbProductId: 0x0005 }],
      });
      await port.open({ baudRate: 115200 });
      const device = new TTBoardDevice(port);
      device.addEventListener('close', () => setBreakoutDevice(null));
      setBreakoutDevice(device);
      setFirmwareUpdateRequired(false);
      void device.start();
    } catch (e) {
      setConnectError(e as Error);
    } finally {
      setConnecting(false);
    }
  };

  onMount(() => {
    setSupported('serial' in navigator);
  });

  onCleanup(() => {
    breakoutDevice()?.close();
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />

      <Stack component="main" maxWidth="100vw" minHeight="100vh" alignItems="center">
        <Header />

        <Stack maxWidth="100%" width={600} flex="1" py={2}>
          <Typography variant="h6" component="div">
            Flash your QSPI Pmod with a new firmware
          </Typography>

          <Typography variant="body1" color="text.secondary" gutterBottom>
            For Tiny Tapeout demo board with a QSPI Pmod attached.
          </Typography>

          <Show when={!supported()}>
            <Stack mt={2}>
              <Typography variant="body1" color="error">
                Your browser does not support the Web Serial API. You can use Chrome, Edge, Opera,
                or Firefox 151 or later (desktop) to connect to the breakout board from this page.
              </Typography>
            </Stack>
          </Show>

          <Show when={supported() && !breakoutDevice()}>
            <Stack mt={2}>
              <LoadingButton onClick={connect} variant="contained" loading={connecting()}>
                Connect to Board
              </LoadingButton>
              <Show when={connectError()}>
                <Typography variant="body1" color="error">
                  Error: {connectError()?.message}
                </Typography>
              </Show>
            </Stack>
          </Show>

          <Show when={breakoutDevice()}>{(device) => <Main device={device()} />}</Show>
        </Stack>

        <Footer />
      </Stack>
    </ThemeProvider>
  );
}
