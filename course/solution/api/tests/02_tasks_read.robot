# @tutorial:begin b-1-list-status
*** Settings ***
Library    RequestsLibrary
Library    Collections

*** Variables ***
${BASE_URL}    http://localhost:3001

*** Test Cases ***
List Tasks Returns 200 And Json
    ${response}=    GET    ${BASE_URL}/api/tasks
    Should Be Equal As Integers    ${response.status_code}    200
    Should Contain    ${response.headers}[Content-Type]    application/json
# @tutorial:end b-1-list-status

# @tutorial:begin b-2-list-content
List Has At Least Ten Tasks
    ${response}=    GET    ${BASE_URL}/api/tasks
    ${tasks}=    Set Variable    ${response.json()}
    ${count}=    Get Length    ${tasks}
    Should Be True    ${count} >= 10

First Task Has The Expected Fields
    ${response}=    GET    ${BASE_URL}/api/tasks
    ${first}=    Set Variable    ${response.json()}[0]
    Dictionary Should Contain Key    ${first}    id
    Dictionary Should Contain Key    ${first}    title
    Dictionary Should Contain Key    ${first}    priority
    Dictionary Should Contain Key    ${first}    done
# @tutorial:end b-2-list-content

# @tutorial:begin b-3-one-task
Task 1 Has The Expected Title
    ${response}=    GET    ${BASE_URL}/api/tasks/1
    Should Be Equal As Integers    ${response.status_code}    200
    Should Be Equal    ${response.json()}[title]    Finish quarterly report
# @tutorial:end b-3-one-task

# @tutorial:begin b-4-not-found
Unknown Task Returns 404
    ${response}=    GET    ${BASE_URL}/api/tasks/999999    expected_status=404
    Should Be Equal    ${response.json()}[error]    Task not found
# @tutorial:end b-4-not-found

# @tutorial:begin b-5-query
Open Filter Returns Only Open Tasks
    ${response}=    GET    ${BASE_URL}/api/tasks    params=done=0
    ${tasks}=    Set Variable    ${response.json()}
    FOR    ${task}    IN    @{tasks}
        Should Be Equal As Integers    ${task}[done]    0
    END

Sort By Priority Is Ascending
    ${response}=    GET    ${BASE_URL}/api/tasks    params=sort=priority&order=asc
    ${tasks}=    Set Variable    ${response.json()}
    ${previous}=    Set Variable    ${0}
    FOR    ${task}    IN    @{tasks}
        Should Be True    ${task}[priority] >= ${previous}
        ${previous}=    Set Variable    ${task}[priority]
    END
# @tutorial:end b-5-query
