import * as YAML from 'yaml';

export function patchYaml(content: string, keyPath: string, value: any): string {
    const doc = YAML.parseDocument(content);

    // Split keyPath (e.g. 'cluster.instances')
    const keys = keyPath.split('.');

    // Set value at path – this preserves comments better than just re-parsing
    doc.setIn(keys, value);

    return doc.toString();
}

export function getDiff(oldContent: string, newContent: string): string {
    // Very simple diff for now, ideally use a proper diff library
    return `--- Values\n+++ New Values\n (Patch applied to ${oldContent.length} bytes)`;
}
