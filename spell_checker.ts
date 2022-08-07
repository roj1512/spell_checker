const dl = Deno.dlopen("/usr/lib/libhunspell-1.7.so", {
  "Hunspell_analyze": {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
  "Hunspell_create": { parameters: ["pointer", "pointer"], result: "pointer" },
  "Hunspell_destroy": {
    parameters: ["pointer"],
    result: "void",
  },
  "Hunspell_spell": { parameters: ["pointer", "pointer"], result: "i32" },
  "Hunspell_suggest": {
    parameters: ["pointer", "pointer", "pointer"],
    result: "i32",
  },
});

function getCStrings(view: Deno.UnsafePointerView, length: number) {
  const pointers = [...new BigUint64Array(view.getArrayBuffer(length * 8))];
  return pointers.map((v) => new Deno.UnsafePointerView(v).getCString());
}

class PointerContainer {
  constructor(private arr = new BigUint64Array(1)) {
  }

  use() {
    return this.arr;
  }

  get() {
    return this.arr[0];
  }
}

export class SpellChecker {
  private instance: bigint;
  private encoder = new class extends TextEncoder {
    encode(input?: string) {
      return new Uint8Array([...super.encode(input), 0]);
    }
  }();

  constructor(affixPath: string, dictionaryPath: string) {
    this.instance = dl.symbols.Hunspell_create(
      this.encoder.encode(affixPath),
      this.encoder.encode(dictionaryPath),
    );
    new FinalizationRegistry((value: bigint) =>
      dl.symbols.Hunspell_destroy(value)
    ).register(this, this.instance);
  }

  check(word: string) {
    return dl.symbols.Hunspell_spell(
      this.instance,
      this.encoder.encode(word),
    ) != 0;
  }

  suggest(word: string) {
    const pointer = new PointerContainer();
    const length = dl.symbols.Hunspell_suggest(
      this.instance,
      pointer.use(),
      this.encoder.encode(word),
    );
    return getCStrings(new Deno.UnsafePointerView(pointer.get()), length);
  }

  analyze(word: string) {
    const pointer = new PointerContainer();
    const length = dl.symbols.Hunspell_analyze(
      this.instance,
      pointer.use(),
      this.encoder.encode(word),
    );
    return getCStrings(new Deno.UnsafePointerView(pointer.get()), length);
  }
}
