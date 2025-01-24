# SPDX-License-Identifier: Apache-2.0
# Copyright (C) 2024, Tiny Tapeout LTD

import binascii
import gc
import sys
import time

import micropython
import rp2
from machine import Pin
from ttboard.demoboard import DemoBoard
from ttboard.mode import RPMode

@rp2.asm_pio(out_shiftdir=0, autopull=True, pull_thresh=8, autopush=True, push_thresh=8, sideset_init=(rp2.PIO.OUT_LOW,), out_init=rp2.PIO.OUT_LOW)
def spi_cpha0():
    out(pins, 1)             .side(0x0)
    in_(pins, 1)             .side(0x1)

@rp2.asm_pio(out_shiftdir=0, autopull=True, pull_thresh=8, autopush=True, push_thresh=8, sideset_init=(rp2.PIO.OUT_LOW,), out_init=rp2.PIO.OUT_LOW)
def spi_cpha1():
    pull(ifempty)            .side(0x0)
    out(pins, 1)             .side(0x1).delay(1)
    in_(pins, 1)             .side(0x0)
    
class PIOSPI:

    def __init__(self, sm_id, pin_mosi, pin_miso, pin_sck, cpha=False, cpol=False, freq=1000000):
        assert(not(cpol))
        if not cpha:
            self._sm = rp2.StateMachine(sm_id, spi_cpha0, freq=2*freq, sideset_base=Pin(pin_sck), out_base=Pin(pin_mosi), in_base=Pin(pin_miso))
        else:
            self._sm = rp2.StateMachine(sm_id, spi_cpha1, freq=4*freq, sideset_base=Pin(pin_sck), out_base=Pin(pin_mosi), in_base=Pin(pin_miso))
        self._sm.active(1)

    @micropython.native
    def write(self, wdata):
        first = True
        for b in wdata:
            self._sm.put(b, 24)
            if not first:
                self._sm.get()
            else:
                first = False
        self._sm.get()
        
    @micropython.native
    def read(self, n, write=0):
        wdata = bytearray(n)
        if write != 0:
            for i in range(n):
                wdata[i] = write
        return self.write_read_blocking(wdata)

    @micropython.native
    def readinto(self, rdata):
        self._sm.put(0)
        for i in range(len(rdata)-1):
            self._sm.put(0)
            rdata[i] = self._sm.get()
        rdata[-1] = self._sm.get()

    @micropython.native
    def write_read_blocking(self, wdata):
        rdata = bytearray(len(wdata))
        i = -1
        for b in wdata:
            self._sm.put(b, 24)
            if i >= 0:
                rdata[i] = self._sm.get()
            i += 1
        rdata[i] = self._sm.get()
        return rdata

class SPIFlash:
    PAGE_SIZE = micropython.const(256)
    SECTOR_SIZE = micropython.const(4096)
    BLOCK_SIZE = micropython.const(65536)

    def __init__(self, tt):
        self.tt = tt
        self.spi = PIOSPI(0, tt.pins.uio1.raw_pin, tt.pins.uio2.raw_pin, tt.pins.uio3.raw_pin, freq=10_000_000)
        self.cs = tt.pins.uio0.raw_pin
        self.cs.init(self.cs.OUT, value=1)

    def read_status(self):
        self.cs(0)
        try:
            self.spi.write(b"\x05")  # 'Read Status Register-1' command
            return self.spi.read(1, 0xFF)[0]
        finally:
            self.cs(1)

    def wait_not_busy(self, timeout=10000):
        while self.read_status() & 0x1:
            if timeout == 0:
                raise RuntimeError("Timed out while waiting for flash device")
            timeout -= 1
            time.sleep_us(1)
            pass

    def identify(self):
        self.wait_not_busy()
        self.cs(0)
        try:
            self.spi.write(b"\x9F")
            return self.spi.read(3, 0x00)
        finally:
            self.cs(1)

    def write_enable(self):
        self.wait_not_busy()
        self.cs(0)
        try:
            self.spi.write(b"\x06")
        finally:
            self.cs(1)

    def erase_sector(self, address):
        self.wait_not_busy()
        self.write_enable()
        self.cs(0)
        try:
            self.spi.write(b"\x20" + address.to_bytes(3, "big"))
        finally:
            self.cs(1)

    def program_page(self, address, data):
        self.wait_not_busy()
        self.write_enable()
        self.cs(0)
        try:
            self.spi.write(b"\x02" + address.to_bytes(3, "big") + data)
        finally:
            self.cs(1)

    def program(self, address, data):
        offset = 0
        while offset < len(data):
            page_address = (address + offset) & ~(self.PAGE_SIZE - 1)
            page_offset = (address + offset) % self.PAGE_SIZE
            chunk_size = min(self.PAGE_SIZE - page_offset, len(data) - offset)
            chunk = data[offset : offset + chunk_size]
            self.program_page(page_address + page_offset, chunk)
            offset += chunk_size

    def program_sectors(self, start_address, verify=True):
        addr = start_address
        gc.collect()
        try:
            micropython.kbd_intr(-1)  # Disable Ctrl-C
            print(f"flash_prog={addr:X}")
            while True:
                line = sys.stdin.buffer.readline()
                if not line:
                    break
                chunk_length = int(line.strip())
                if chunk_length == 0:
                    break
                chunk_data = sys.stdin.buffer.read(chunk_length)
                end_address = addr + len(chunk_data)
                for erase_addr in range(addr, end_address, self.SECTOR_SIZE):
                   self.erase_sector(erase_addr)
                self.program(addr, chunk_data)
                if verify:
                   read_back_data = self.read_data(addr, len(chunk_data))
                   if read_back_data != chunk_data:
                       raise RuntimeError("Verification failed")
                addr += len(chunk_data)
                print(f"flash_prog={addr:X}")
        finally:
            micropython.kbd_intr(3)
        print(f"flash_prog=ok")

    def read_data(self, address, length):
        self.wait_not_busy()
        self.cs(0)
        try:
            self.spi.write(b"\x03" + address.to_bytes(3, "big"))
            return self.spi.read(length)
        finally:
            self.cs(1)


tt = DemoBoard.get()
tt.mode = RPMode.ASIC_RP_CONTROL
tt.shuttle.tt_um_chip_rom.enable()
flash = SPIFlash(tt)
print(f"tt.flash_id={binascii.hexlify(flash.identify()).decode()}")
