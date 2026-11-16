#!/bin/bash
# End-to-end API smoke test against a running local server.
# Usage: ADMIN_PASSWORD='...' bash scripts/api-test.sh [http://localhost:8787]
B=${1:-http://localhost:8787}
PW=${ADMIN_PASSWORD:?set ADMIN_PASSWORD}
T=$(mktemp -d) && cd "$T"
O="Origin: $B"; J="content-type: application/json"
jq_() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

echo "--- unauthenticated admin API (expect 401):"; curl -s -o /dev/null -w "%{http_code}\n" $B/api/admin/projects
echo "--- login without Origin header (expect 403):"; curl -s -w " %{http_code}\n" -X POST -H "$J" -d '{"password":"x"}' $B/api/admin/login
echo "--- wrong password (expect 401):"; curl -s -w " %{http_code}\n" -X POST -H "$O" -H "$J" -d '{"password":"nope"}' $B/api/admin/login
echo "--- right password:"; R=$(curl -s -c cj -D hdr -X POST -H "$O" -H "$J" -d "{\"password\":\"$PW\"}" $B/api/admin/login); echo "$R" | cut -c1-30
grep -i set-cookie hdr | sed 's/archive_sid=[^;]*/archive_sid=<redacted>/'
CSRF=$(echo "$R" | jq_ "d['csrf']")
echo "--- mutation without CSRF token (expect 403):"; curl -s -b cj -w " %{http_code}\n" -X POST -H "$O" -H "$J" -d '{"title":"T","year":2024}' $B/api/admin/projects
H=(-b cj -H "$O" -H "$J" -H "x-csrf-token: $CSRF")
echo "--- javascript: URL (expect 400):"; curl -s -w " %{http_code}\n" "${H[@]}" -X POST -d '{"title":"Bad","year":2024,"githubUrl":"javascript:alert(1)"}' $B/api/admin/projects
P1=$(curl -s "${H[@]}" -X POST -d '{"title":"First Robot","year":2016,"category":"Hardware","shortDescription":"A tiny line follower","technologies":["Arduino","C++"],"status":"published"}' $B/api/admin/projects)
P2=$(curl -s "${H[@]}" -X POST -d '{"title":"Secret Draft","year":2025,"status":"draft"}' $B/api/admin/projects)
P3=$(curl -s "${H[@]}" -X POST -d '{"title":"Weather Toy","year":2019,"category":"Web","status":"published"}' $B/api/admin/projects)
ID1=$(echo "$P1" | jq_ "d['project']['id']"); ID2=$(echo "$P2" | jq_ "d['project']['id']"); ID3=$(echo "$P3" | jq_ "d['project']['id']")
echo "created: ${ID1:0:8} ${ID2:0:8} ${ID3:0:8}"
echo "--- public list (draft absent, no status field):"; curl -s $B/api/public | jq_ "[(p['title'],'status' in p) for p in d['projects']]"
echo "--- reorder to [3,2,1]:"; curl -s "${H[@]}" -X PUT -d "{\"ids\":[\"$ID3\",\"$ID2\",\"$ID1\"]}" $B/api/admin/projects/order; echo
curl -s $B/api/public | jq_ "[p['title'] for p in d['projects']]"
echo "--- reorder with missing ids (expect 400):"; curl -s -w " %{http_code}\n" "${H[@]}" -X PUT -d "{\"ids\":[\"$ID3\"]}" $B/api/admin/projects/order
echo "--- duplicate:"; curl -s "${H[@]}" -X POST $B/api/admin/projects/$ID1/duplicate | jq_ "(d['project']['title'],d['project']['slug'],d['project']['status'],d['project']['position'])"
echo "--- text disguised as .png (expect 415):"; echo "<script>alert(1)</script>" > fake.png; curl -s -w " %{http_code}\n" -b cj -H "$O" -H "x-csrf-token: $CSRF" -F "file=@fake.png;type=image/png" $B/api/admin/media
python3 -c "
import struct,zlib
def ch(t,d): c=struct.pack('>I',len(d))+t+d; return c+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
raw=b''.join(b'\x00'+b'\x80\xc0\xff'*8 for _ in range(8))
open('ok.png','wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',8,8,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))"
echo "--- real PNG:"; M=$(curl -s -b cj -H "$O" -H "x-csrf-token: $CSRF" -F "file=@ok.png" $B/api/admin/media); echo "$M"; KEY=$(echo "$M" | jq_ "d['key']")
curl -s -D - -o /dev/null $B/media/$KEY | grep -iE "^(HTTP|content-type|cache-control|x-content|content-security)"
echo "--- set cover, then delete while in use (expect 409):"; curl -s "${H[@]}" -X PUT -d "{\"title\":\"First Robot\",\"year\":2016,\"coverKey\":\"$KEY\",\"status\":\"published\"}" $B/api/admin/projects/$ID1 | jq_ "d['project']['coverKey'][:8]"
curl -s -w " %{http_code}\n" "${H[@]}" -X DELETE $B/api/admin/media/$KEY
echo "--- save settings:"; curl -s "${H[@]}" -X PUT -d '{"displayName":"Test Archive","browserTitle":"Archive","contactEmail":"a@b.co","clouds":false,"intensity":3,"githubUrl":"https://github.com/example"}' $B/api/admin/settings | jq_ "(d['settings']['displayName'],d['settings']['clouds'],d['settings']['intensity'])"
echo "--- logout, then reuse old cookie (expect 401):"; curl -s -b cj -H "$O" -H "x-csrf-token: $CSRF" -X POST $B/api/admin/logout; echo; curl -s -b cj -w " %{http_code}\n" $B/api/admin/projects
echo "--- rate limit: 7 wrong passwords in a row (expect 401 x5 then 429):"; for i in 1 2 3 4 5 6 7; do curl -s -o /dev/null -w "%{http_code} " -X POST -H "$O" -H "$J" -d '{"password":"guess"}' $B/api/admin/login; done; echo
