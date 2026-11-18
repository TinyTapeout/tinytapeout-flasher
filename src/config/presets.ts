// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026, Tiny Tapeout B.V.
// Author: Uri Shaked

const ttRiscvImages = 'https://tinytapeout.github.io/tt-riscv/images/latest/';

export const presets = [
  {
    name: 'KianV uLinux, 16 MiB (TTSKY25a/b, TTIHP25b, TTGF0P2)',
    baseUrl: ttRiscvImages,
    files: [
      { offset: 1048576, name: 'kianv-ulinux-bootloader.bin' },
      { offset: 1572864, name: 'kianv-ulinux-kianv.dtb' },
      { offset: 2097152, name: 'kianv-ulinux-Image' },
    ],
  },
  {
    name: 'KianV memtest, 16 MiB PSRAM',
    baseUrl: ttRiscvImages,
    files: [{ offset: 1048576, name: 'kianv-memtest.bin' }],
  },
  {
    name: 'KianV Zephyr + MicroPython dual-boot',
    baseUrl: ttRiscvImages,
    files: [{ offset: 1048576, name: 'kianv-zephyr-dualboot.bin' }],
  },
  {
    name: 'KianV uLinux Image (legacy, for TT06)',
    baseUrl: 'https://urish.github.io/tt-kian-riscv-firmware/',
    files: [
      { offset: 1048576, name: 'bootloader.bin' },
      { offset: 1572864, name: 'kianv.dtb' },
      { offset: 2097152, name: 'Image' },
    ],
  },
  {
    name: 'Run Length Encoded Bad Apple Video (TT07)',
    baseUrl: 'https://tt.rebel-lion.uk/',
    files: [{ offset: 0, name: 'tt07-badapple640x480.bin' }],
  },
  {
    name: 'Run Length Encoded Bad Apple Video with audio (TTSKY25a)',
    baseUrl: 'https://tt.rebel-lion.uk/',
    files: [{ offset: 0, name: 'ttsky25a-badapple.bin' }],
  },
];
