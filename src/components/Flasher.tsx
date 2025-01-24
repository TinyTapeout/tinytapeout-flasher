// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2024, Tiny Tapeout LTD
// Author: Uri Shaked

import {
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@suid/material';
import { createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { presets } from '~/config/presets';
import { TTBoardDevice } from '~/ttcontrol/TTBoardDevice';
import { MB, toKB } from '~/utils/sizes';

export interface IReplPanelProps {
  device: TTBoardDevice;
}

const MAX_FLASH_SIZE = 16 * MB;
const CUSTOM_FIRMWARE = 'custom';

interface IFileFlashStatus {
  file: string;
  status: string;
  flashing: boolean;
  total: number;
  written: number;
}

export function FlashPanel(props: IReplPanelProps) {
  let fileInput: HTMLInputElement | undefined;
  const [selectedFirmware, setSelectedFirmware] = createSignal('0');
  const [flashOffset, setFlashOffset] = createSignal(0);
  const [programming, setProgramming] = createSignal(false);
  const [customSize, setCustomSize] = createSignal(0);
  const [customProgress, setCustomProgress] = createSignal(0);
  const [fileStatus, setFileStatus] = createStore([] as Array<IFileFlashStatus>);

  const updateFileStatus = (name: string, value: string | Partial<IFileFlashStatus>) => {
    if (typeof value === 'string') {
      setFileStatus((f) => f.file === name, { status: value });
    } else {
      setFileStatus((f) => f.file === name, value);
    }
  };

  const doFlash = async () => {
    try {
      setProgramming(true);
      setFileStatus([]);

      if (selectedFirmware() === CUSTOM_FIRMWARE) {
        const file = fileInput?.files?.[0];
        if (!file) {
          alert('No file selected');
          return;
        }
        const buffer = await file.arrayBuffer();
        setCustomSize(buffer.byteLength);
        await props.device.programFlash(flashOffset(), buffer, (progress) => {
          setCustomProgress(progress);
        });
        return;
      }

      const preset = presets[parseInt(selectedFirmware(), 10)];
      const fileData = [];
      setFileStatus(
        preset.files.map((file) => ({
          file: file.name,
          status: '',
          total: 0,
          written: 0,
          flashing: false,
        })),
      );
      for (const file of preset.files) {
        const url = new URL(file.name, preset.baseUrl);
        updateFileStatus(file.name, 'Downloading...');
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        fileData.push({ name: file.name, offset: file.offset, data: buffer });
        updateFileStatus(file.name, 'Downloaded');
        updateFileStatus(file.name, { total: buffer.byteLength });
      }

      for (const { name, offset, data } of fileData) {
        updateFileStatus(name, 'Flashing...');
        await props.device.programFlash(offset, data, (progress) => {
          updateFileStatus(name, { written: progress, flashing: true });
        });
        updateFileStatus(name, {
          flashing: false,
          status: `✅ ${toKB(data.byteLength)} kB`,
        });
      }
    } finally {
      setProgramming(false);
    }
  };

  return (
    <Stack spacing={1}>
      <FormControl>
        <FormLabel id="demo-radio-buttons-group-label">Firmware</FormLabel>
        <RadioGroup
          aria-labelledby="demo-radio-buttons-group-label"
          value={selectedFirmware()}
          onChange={(e) => {
            setFileStatus([]);
            setCustomProgress(0);
            setSelectedFirmware((e.target as HTMLInputElement).value);
          }}
          name="radio-buttons-group"
        >
          <For each={presets}>
            {(preset, index) => (
              <FormControlLabel value={index()} control={<Radio />} label={preset.name} />
            )}
          </For>
          <FormControlLabel value={CUSTOM_FIRMWARE} control={<Radio />} label="Custom" />
        </RadioGroup>
      </FormControl>
      <Show when={presets[parseInt(selectedFirmware())]}>
        {(preset) => (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Offset</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <For each={preset().files}>
              {(file) => (
                <TableRow>
                  <TableCell>0x{file.offset.toString(16)}</TableCell>
                  <TableCell>
                    <a href={new URL(file.name, preset().baseUrl).toString()} download>
                      {file.name}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Show when={fileStatus.find((f) => f.file === file.name)}>
                      {(item) => (
                        <>
                          <Show when={item().flashing}>
                            <LinearProgress
                              variant="determinate"
                              sx={{ height: 12 }}
                              value={(item().written / item().total) * 100}
                            />
                          </Show>
                          <Show when={!item().flashing}>{item().status}</Show>
                        </>
                      )}
                    </Show>
                  </TableCell>
                </TableRow>
              )}
            </For>
          </Table>
        )}
      </Show>
      <Show when={selectedFirmware() === CUSTOM_FIRMWARE}>
        <Typography>
          <TextField
            sx={{ maxWidth: 160 }}
            label="Flash offset (decimal)"
            type="number"
            size="small"
            value={flashOffset()}
            InputProps={{ inputProps: { min: 0, max: MAX_FLASH_SIZE } }}
            fullWidth
            onChange={(e) => {
              setFlashOffset((e.target as HTMLInputElement).valueAsNumber);
            }}
          />
        </Typography>

        <Typography>
          File to flash: <input type="file" ref={fileInput} />
        </Typography>
        <Show when={programming()}>
          <Stack spacing={1}>
            <LinearProgress
              variant="determinate"
              sx={{ height: 12, width: 140 }}
              value={(customProgress() / customSize()) * 100}
            />

            <Typography>
              {toKB(customProgress())} / {toKB(customSize())} kB
            </Typography>
          </Stack>
        </Show>
        <Show when={customProgress() > 0 && customProgress() === customSize()}>
          <Typography>✅ Flashing complete</Typography>
        </Show>
      </Show>
      <Button variant="contained" onClick={doFlash} disabled={programming()}>
        Flash
      </Button>
    </Stack>
  );
}
