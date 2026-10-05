*** Settings ***
Library    RequestsLibrary

*** Variables ***
${BASE}    http://localhost:3001

*** Test Cases ***
Health Returns 200
    ${r}=    GET    ${BASE}/api/health
    Should Be Equal As Integers    ${r.status_code}    200

Empty Title Is Rejected
    ${body}=    Create Dictionary    title=${EMPTY}
    ${r}=    POST    ${BASE}/api/tasks    json=${body}    expected_status=400
    Should Contain    ${r.json()}[error]    title

Done Sets Completed At
    ${body}=    Create Dictionary    title=Finish me
    ${t}=    POST    ${BASE}/api/tasks    json=${body}
    ${done}=    Create Dictionary    done=${True}
    ${r}=    PATCH    ${BASE}/api/tasks/${t.json()}[id]/done    json=${done}
    Should Not Be Equal    ${r.json()}[completed_at]    ${None}

Unsafe Sort Is Rejected
    ${r}=    GET    ${BASE}/api/tasks    params=sort=title;drop    expected_status=400
