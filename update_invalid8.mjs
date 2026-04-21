import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const mapping = [
  { tokenId: 1569, oldHash: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', newHash: '0x3402ecf21d817a8e648f1786cd9a65cc04db2bf231b1990f23681e9878d0a2b2', newSha: 'e40a0b379f16dce8923378ec9f7dd08169ce7854bd75b6017ec9bd4c13759e11', block: 24668293 },
  { tokenId: 2103, oldHash: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3', newHash: '0xce4222491cb09aa238d19f3a71c388a46f2ecc45f04cea4f63ee796029f7ec56', newSha: '4f9f54cab45631a35c7ee067cdd39e945e17771a419e36d5595479eb8895ec5f', block: 24668298 },
  { tokenId: 3080, oldHash: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb', newHash: '0xa1a5a3a32c20d4984026c35db6989745da83909e5b8acb55eb1ad76d38421c2d', newSha: '7eb31cbc563f198857b900fe23d80a3b8f29b41949e993e17b8747025f756048', block: 24668300 },
  { tokenId: 3719, oldHash: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d', newHash: '0xc3b617e29be433bf711ce70f3c0cb534421c0f561f0c81322ce08c62bcd58ffb', newSha: '7c62f9d413e376fc0b2eb9300e2bef33290aa24388ba0a5449b3085683f63924', block: 24668305 },
  { tokenId: 8663, oldHash: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd', newHash: '0x53083c7f14a5233befb6933a12eeba8012a126ede10a0435358b1befd2c11af4', newSha: '2a5b47386370c7a756ee25b4ca05fb71fa752ea73499cbf5716858f94dcd7465', block: 24668313 },
  { tokenId: 8699, oldHash: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', newHash: '0x2e232e6a9edab1de6667a09b66a46e3cdceebf6455bd71748dae37793acd69bf', newSha: '298d9330f5d7448853b1f2b40d21ce687df19422795fa2343d0093224d8578a4', block: 24668313 },
  { tokenId: 9360, oldHash: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', newHash: '0x85f349d41feaf21d6efe953bf52147598a18a219364f169a4abd730bf6ae4092', newSha: '6f8be3828c449397edc9bd27ed39e287803e671bdc460a685d51aee021d75323', block: 24668313 },
  { tokenId: 9363, oldHash: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573', newHash: '0x091f594cdb17c1a1417e4b3a1c9dce06c7957a558609d87c840318c365da3e44', newSha: '56c257dc77294287cf7d0985fa3d8db5d00d9b2b8fb0a66336ba1e8f90ea6855', block: 24668320 },
];

// Content URIs from ethscriptions.com (base64 PNG)
const contentUris = {
  1569: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAxRJREFUSImtlU9IVFEUxn+3mafTKFGLaCFoagyRRc0qayMSFQUWSYsgHPuzaCYo0oVtIoJqYQtdZI0tChQXLUzIoEILU8QkMLNxXAxNpjH9gf4wZqaJ3hbjvfPezBsw8MDlwXn3ft93vnvOe7AyIZdWWqxaARDZFWon2FmP3fskwfNHko42WxWAlFJmAhH7th0FoCboS3ufJDCMxLIPIYQA4OTVI7ZKARr8LWm55RLouHepIzUlu0LtANQ2V2cgGBmQGM4EwfXLqeokIJfs4dS1Snbs9eh8V6id6HiUSCxMY6AVQJgPO7V69VxluXetLjoetbAqwuh4FH9Fna36ZAXKHqtNWp0Cj8TCDPeFOXPuNP6KOp2rba62VW8lyFpapntQwIFDFzVgeWUpxYXFdI8+IBILA9DTMWirPsn4KSKZn4f4FPS/hLO1SokMdtZrIE9eCQD+ijqEENomFYFDF9OqEOu+T8qfiwskCOLQP5iopNpPTdCnQTNFJBamwd9C86MbtiTC/furnJn/i67g1RAYBjXfnuHJK8FfUacPAxzcfoyCggImJiZ4PHJfV6fCk1eiSACEc9ZwJufGMMDtBsOpD5jBAfLz85PPkURO3cGb7gg1QZ+aaBoDrVIgpxL+qwpGx8AwCP4a1SVLKdOIlD09HYOUV5aau8g8R0vzPzIgmZ1LkCwu4ig/wPmmqoz+FxcW86S/U3t/5+Zd3nRHsGvTZGK0W5KbAxt3AwiHwyHPNx3XJE83tQFQ1OvVOeW/IrLrIj222dkuC+nCwoIFWMX7smFL2zYGWhFCEImFzV9baQEDWP3xlfzjMmC9VwDywu0qfpx4R/zDNGv3v7O1qvTWFS3i4ZaQpa1VNZog98trOe3KgrVb9ZD5ZnYR/zBNUa+X92XDFvCiXq+uCODn5zh9eybT7E/6pS56Z7nZQ01iF0W9XoY8L8zAmS95zfeQnHIZkLM5dZP0zeyyJMyEJuVp4OjPNeBwu8FhK1S0ul+m/cEOj22z3ZwauouyXNlsMLIz7RMpa9mhK/j6dhJm5/7n7LLiH+XTWg0my0pHAAAAAElFTkSuQmCC',
  2103: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAoJJREFUSIm1lr1rFFEUxX9vMpsvGBuZSIoQWItNEZZFxCJZUFC0sA4SmyzkH0ilhRAMKgZspkoXmULUKKKdTQIW0VKWBSHZL1ksDGwjjl+YzF6LZCbzMjO7GvDAg8c7d8657947zMB/hurBSyROusSl6oSEqQZEZA/fFNjrKEDskgVA2/XIOvqDXtkK923XSzUxAVRmWFYqH2g9fcy9O7cIxN8tlQGYogB4mnjABXzb9STRRClDVrY+y+Likgx/H5EDcam1GjI0mJGhwYzYJUuyDuGyS1bI1VoNqbUaYpcsSSqjIaqDKQO4Tx5yKn8yJPK5CSrbW2mlBaCyvUU+N9E1xkDA7xP6JcON1+samc9NMLq8i1XwtHOr4DG6vBsTP+iTdgsj2HSUD2pAe2B0eReA5sL+utucjPFBTJpJaGBIHw8uT2kZBuIAsnYBiJsAXHl5Wrtl1CRi4NP8WNXGURP/dphpw5qOmaTBDDZKZTQiEAdQ195o3PXI/uj7kWqwXa8mBq8Vdnj24zeVyQ7GrMHZc5dwdvr4+cJHXgnjC7WuJkbSYTT7buIBGl/+0SCKqPijdVsTH6/WkNXpWFJRmMnHh6jOzsPXX7BuAzCWs+HmPieMaLHNhXhPDDDpFz9RXJ5f3BfvhbFp5HYyZSh8lNrrLXJMmAD3r57XDrOOXtP388ljcmY1pfBRAxFR9XpdNjc3KRaLiSP3N0JReGULuwRt15OwySKCiKCUwi5ZZB0PNbPRuw+f3qIO6p919A8RSWOqlKLtenhli6wDamYDTgzqKwFJ4gQ9EBHm5uZQKvwgqbbrCZGbHEUw/70QlqjZbMYuEzWJIumlSso+atDr7+LY+APddRyOHZRySgAAAABJRU5ErkJggg==',
  3080: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAbJJREFUSIntlD9Iw0AUh7/TjsJlLBIcRDCFCg5WZ60420lwdRPM7lAHlw46VXATnLrGXcVNkCwKBaM4dsjYLN3quTSxf3J3Vhx94chxj/t97917d/Bv01i9XlcalzIMoxXSSaPRUL1eL1e8Vqvlbu50OoRhqAChA8xYAtCKA7iuS6VSwZRJQedINwVBkOtMwa7rEoahVkQHUIPItBYEAabsbABjVMOQ3wLSoilVVnz2P7UCD68PbLM9NeCb1NY2CABSSkj0flsXcTf4bGtSSiWlnOgmawZVVUUIoV1LkgQpZfZPIUmSiB8BxsV1a8OiU2VgKzKDQlffDhHL7xM+Uw2sHZTaZmmT++VL8m60NYPZ11mjv1/qG/3WLgKIHYe46bAYOzjxNU78jrMa/2SrHdDyyxS7XU5PIh69iMiLiLx1us9FWn45b8vIMZmOSIi2UAoF/gr7zSKXY+C925eRm3zkewBcNKPsCZ8AHGygrp6yp0KItlCtrbIu2szOztey+ZHvZZBCKvpxc6zNZL/Zzn3v90pGJgzXYGm3wfxOnaHoRyBjw9g9Cwtz6XGpGUAn+if2BdYiptOr79JEAAAAAElFTkSuQmCC',
  3719: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAVtJREFUSIljYBgRoNJb8H+lt+B/QmLYACMxhhNS0771PU5zmAhpphTQ3AIUr1V6C/5H9m6APivB4IGBDRd/w/Uhm8OCrpCYMMcGNGUYsOrDiBxyLUAGyKFAKBX9j/xizPDt0S+cCt4//8hwyPkRTrOoGsk/bWz+/7SxQQkBvD5AVvy39w3DmV3PGMx36mFVe/bhQwYGBgYGq8ePUczEa8ExWVm4BX/SPjKYuEkxXAj5ilWt1ePHWM0j2gcwFxrLy1PPB8REMgMDA8OddS8Yrta8ZjgmKwt3APuRI4yELPhvPlWeQcKRD6/hL/Z/Yvjy/hsDAwMDw9Wa1xhmYmQ0bAYQAjyCXAzsGtizD0ELGBgYGD62vcIqzl8lRlAvURYQYxAuQDCSzadiTzUw8OX9N1jYYzWPYIUDS0nIADlVESoqiAkixuU8ZzFi0P+aLhFaiYwDLK4jusSleY0GAD8pgdMpI0avAAAAAElFTkSuQmCC',
  8663: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAQhJREFUSIljYBgFwx4wEqNoKxfDf1xy3t/wm8FEtOFqGiRbTpQFcMNv3SDsCCyAhSgNeAwnBFB8cPfu3QZCXiYVYPgALdIotgxrECGDOFlZBgYGBoaU4GAGBgYGBrsJEzDkFz1+jFM/wUhe+OgRXgNSgoNhjsDqW4IW3G9uZjhUUADn42LjAgSDCBsgxmAYwJcL/99ramJ48u4dUQbNWbsWFpQoZqL7ACUclerqGBhIdDE6QLbg/6NoNYYn2QswFFlZWWHVTGocMMotvfWfYSmmYZT4gFBpSjAekMIeq3mEkimjUl0dg4yQEAomxbHEJFNGpbo6jExEbLARmw/QXUd0GUVcfUABAAAz2lV9L4oceAAAAABJRU5ErkJggg==',
  8699: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAfxJREFUSInNlLFrE1Ecxz/vUhEnF9F6hYSmenW8wSFtt4CDg5BZV0HIaCf9B3RxLRakWzO7BSwECqY4OGSy9YTES8mlQwSrARHtPYf2znf33uWu4OAXDu6933vf7+/3+/7u4H/C0HFkkT0VIo+w7HnCRFT2PKHuRefOLZBFmMa5BVSylek3ksxzAARBwNC5MVPIMhEnyL9PQVoctr6cxrcnQAiE2PY8Fc/TyNX7moCaQW06RQoLv3XEwoNr+K0JlftX8bcn8Xn7uh2LpJP7W2u2iAQQn0scjQIYzBGMA6zBBdM1Y4s0D+YXbAkhllSLC8+KPd0TMmQ0DrBtGyEhGAf4jlNMIAX5YeUZ/o9J5oHXg3dsHncZngmkRXIFcuIxsgSMHqh4dHkNgMZiDYC7vRdafPO4ayQvJPDy61uEEDSoGeONxRoMoOwl2xRBG9M09lef03bX43XWexZyKzDBRCw/Ohze08/OMjl3glSo06T6kNuiPHR/fkqsC5t8sieAp4yaVeobfQBKq8mpbbvrrF28OTMBo8COuyShT0chf9N8TNvNrygNzYMdd0lGpACdZpXfNDIJot5n8SU86Dy8FZN3mlUA6ht9KpeuJJ6iyWJq0e7WMifvf6EK3ek90S4W+QY0gfqrAxFVsru1DEDpNtDTsiv8jzKaHAn9C/wBVwnbj97j7KsAAAAASUVORK5CYII=',
  9360: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAbRJREFUSIm9Va9Pw0AYfd+2Jsgt2QICg0Q1af+BqYltYg7kJhAogmPzgGUKgShyEgEC1AyOLJkgCBJMyWC0yQyCjCwfgvXodW2vXRZecsn9+O69e9/9Av4TRMSr5swkCWrXCtyuFVjVFwaSGkTMzFJfEpLTmwlFjQkHpmmyYRgqrtQQAtPpFIPBAKZprnQfcl5F0zQcVfO4e/9LVUPX+On1U0nS0DW+Gn6LNLVrBfbSJgRmsxkAoLLxgko1DwCpnGxvhseLFGWzWdy+baXhjETopuu6zkTEhmH4V8Jn94cMgDu9Jnd6zYX6XrfOcW6Fkkds2zYcxyGfAD7sSeRqnbGLi4NrBI+8B2kPRqPRQsDjw7Ool9aLcMau1FaBiIiLxd/AVqsFy7IkB8wMIkKn1xSTjncsqS/OhSRQLpfR7/fhui7mN1qZIpVAjpnJcRyUSqWlLtjJ7mXsOMH3inpO5ikSgv70JCCWXRARewIBF7xkiVYLvKYieF9fC13q+fBL6UA0PBdhAikhCcR9OJFvfJo5GcR/lUqRvW49NjaT4B+OFAk7XUHklBHhIpyEHN5FSyiyFH4AF9fM6AYSl5IAAAAASUVORK5CYII=',
  9363: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAaZJREFUSIntlb9OwlAUh79LnAw+gKZJGRzQBu1ClFWNo5FnYMPB4ObAzCabi/EZUGeDI5oOGkGJiYNNeAMJmxwHaK2lvS2Jo7+kaXvuPec7v5P+gX/No3q9LjFLojm0WvAuGo2GjEajyOLlcjkyeTAY4DiO1LIdmsOS0gLiOo8rDmAYBgBNp0Qt2xFgBqQDCECr1Ypc9MCGYeA4DlHFdQApFosa9gQcdhflItaB11USJKy0I1JeR2ef21rIydL9r/uwi4wuuTksAbB2szez5sWOe8szDlKNyFPhfIeF6blbbVM439EmzuUA4Ovxk97RHd1qG4Bute3HAEzTjHThXScCXi8c8te7ibEoF6QZEUD/4Ja+mjS1JuLHohR+inQO5GN9MxHuWvavMQW7J40D17JRAotTmGvZ2v3zfCoAUALm23MgkgHGAHzkN8LFZ/K1APPlCdeyA4Uykw+UGqPkZ49OOoBSSomIBMYynrzigeKu65LL5fycREBlC7l88Df6kBSK/x9UtpD3q1Otk3AwJfTnMV09bLCyXyfQfbi74JFaGSCu6J/oG0wmssP3dWoJAAAAAElFTkSuQmCC',
};

// 1. Update JSON file
console.log('=== Updating JSON file ===');
const jsonPath = 'C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json';
const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
for (const m of mapping) {
  const item = json.collection_items.find(x => x.index === m.tokenId);
  if (!item) { console.log(`  #${m.tokenId}: NOT FOUND in JSON`); continue; }
  const oldHash = item.id;
  const oldSha = item.sha;
  item.id = m.newHash;
  item.sha = m.newSha;
  console.log(`  #${m.tokenId}: id ${oldHash.slice(0,14)}→${m.newHash.slice(0,14)} sha ${oldSha.slice(0,14)}→${m.newSha.slice(0,14)}`);
}
writeFileSync(jsonPath, JSON.stringify(json, null, 2));
console.log('  JSON saved.');

// 2. Upload new images to Supabase storage
console.log('\n=== Uploading images to storage ===');
for (const m of mapping) {
  const contentUri = contentUris[m.tokenId];
  const base64 = contentUri.split(',')[1];
  const imageBuffer = Buffer.from(base64, 'base64');
  const { error } = await sb.storage.from('static').upload(`images/${m.newSha}`, imageBuffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) console.log(`  #${m.tokenId}: upload error: ${error.message}`);
  else console.log(`  #${m.tokenId}: uploaded images/${m.newSha.slice(0,14)}...`);
}

// 3. Update Supabase ethscriptions table
console.log('\n=== Updating Supabase ===');
for (const m of mapping) {
  // Delete events first (FK constraint)
  const { error: evErr } = await sb.from('events').delete().eq('hashId', m.oldHash);
  if (evErr) console.log(`  #${m.tokenId} events delete error: ${evErr.message}`);

  // Also check for lowercase
  const { error: evErr2 } = await sb.from('events').delete().eq('hashId', m.oldHash.toLowerCase());
  if (evErr2 && evErr2.code !== 'PGRST116') console.log(`  #${m.tokenId} events delete (lower) error: ${evErr2.message}`);

  // Update the ethscription row
  const { data, error } = await sb
    .from('ethscriptions')
    .update({
      hashId: m.newHash,
      id: m.newHash,
      sha: m.newSha,
      createdAt: m.block,
    })
    .eq('hashId', m.oldHash)
    .select();

  if (error) {
    console.log(`  #${m.tokenId}: update error: ${error.message}`);
    // Try lowercase
    const { data: d2, error: e2 } = await sb
      .from('ethscriptions')
      .update({ hashId: m.newHash, id: m.newHash, sha: m.newSha, createdAt: m.block })
      .eq('hashId', m.oldHash.toLowerCase())
      .select();
    if (e2) console.log(`  #${m.tokenId}: update (lower) error: ${e2.message}`);
    else console.log(`  #${m.tokenId}: updated (lowercase) rows=${d2?.length}`);
  } else {
    console.log(`  #${m.tokenId}: updated rows=${data?.length}`);
  }
}

// 4. Update attribute file
console.log('\n=== Updating attribute file ===');
const attrUrl = `${env.SUPABASE_URL}/storage/v1/object/public/data/cryptophunksv67_attributes.json`;
const attrRes = await fetch(attrUrl);
if (!attrRes.ok) {
  console.log('  Could not fetch attribute file:', attrRes.status);
} else {
  const attrs = await attrRes.json();
  let changed = 0;
  for (const m of mapping) {
    // Find old sha in attrs
    const oldShaEntry = json.collection_items.find(x => x.index === m.tokenId);
    // We already updated json, so we need old sha from mapping
    const oldSha = Object.keys(attrs).find(k => {
      // The old sha was the sha before this update - we know it from the original
      return false; // we'll use explicit mapping
    });
  }

  // Explicit old→new sha mapping
  const shaMapping = {
    '2f829031713d4b6253dcefd9eab48bd55ae154430ccf6c279b27d49535b91155': 'e40a0b379f16dce8923378ec9f7dd08169ce7854bd75b6017ec9bd4c13759e11', // #1569
    'dcb130d85be00f8fd735ddafcba1cc83f99ba8dab0fc79c833401827b615c92b': '4f9f54cab45631a35c7ee067cdd39e945e17771a419e36d5595479eb8895ec5f', // #2103
    '9477946644d153eee424f9fa2a747f6a23741c136eac2154c49d51643d746d25': '7eb31cbc563f198857b900fe23d80a3b8f29b41949e993e17b8747025f756048', // #3080
    '504cd67bd212720e37e84fc714da78cdcc1e2daf05c1882219d99d22de8dee66': '7c62f9d413e376fc0b2eb9300e2bef33290aa24388ba0a5449b3085683f63924', // #3719
    '6270bd7d337abc5c8a63a8ea91648b090bffa9305976830fee9abbd0cc334598': '2a5b47386370c7a756ee25b4ca05fb71fa752ea73499cbf5716858f94dcd7465', // #8663
    '2ffedd2fbe178264aa85efe373a909cec25289c5a3011a21584f0a5d33ac6488': '298d9330f5d7448853b1f2b40d21ce687df19422795fa2343d0093224d8578a4', // #8699
    '0315396844c62f156ce38cc33f1ccb2d5ed675dbf3edf8b3439a2c560772d7da': '6f8be3828c449397edc9bd27ed39e287803e671bdc460a685d51aee021d75323', // #9360
    '71623482768fce52582dea82354777da497d8fd01d992d7b88100d8662cd4225': '56c257dc77294287cf7d0985fa3d8db5d00d9b2b8fb0a66336ba1e8f90ea6855', // #9363
  };

  const updatedAttrs = {};
  for (const [k, v] of Object.entries(attrs)) {
    const newKey = shaMapping[k] || k;
    if (newKey !== k) changed++;
    updatedAttrs[newKey] = v;
  }
  console.log(`  SHA keys updated: ${changed}`);

  const attrJson = JSON.stringify(updatedAttrs);
  const { error: uploadErr } = await sb.storage.from('data').upload(
    'cryptophunksv67_attributes.json',
    Buffer.from(attrJson),
    { contentType: 'application/json', upsert: true }
  );
  if (uploadErr) console.log('  Attr upload error:', uploadErr.message);
  else console.log('  Attribute file updated.');
}

console.log('\nDone!');
