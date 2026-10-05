# @tutorial:begin c-1-head
*** Settings ***
Library    RequestsLibrary
# @tutorial:end c-1-head
# @tutorial:begin c-4-db-setup
Library    DatabaseLibrary
Suite Setup    Connect To Database    pymysql    db_name=taskapp_test    db_user=robot    db_password=robot_pw    db_host=db    db_port=3306
Suite Teardown    Disconnect From All Databases
# @tutorial:end c-4-db-setup
# @tutorial:begin c-5-teardown
Test Teardown    Execute Sql String    DELETE FROM tasks WHERE title LIKE 'Robot %'
# @tutorial:end c-5-teardown

# @tutorial:begin c-1-create
*** Variables ***
${BASE_URL}    http://localhost:3001

*** Test Cases ***
Create Task Returns 201 And The Task
    ${body}=    Create Dictionary    title=Robot task one    priority=${2}
    ${response}=    POST    ${BASE_URL}/api/tasks    json=${body}
    Should Be Equal As Integers    ${response.status_code}    201
    Should Be Equal    ${response.json()}[title]    Robot task one
    Should Be True    ${response.json()}[id] > 0
# @tutorial:end c-1-create

# @tutorial:begin c-2-empty-title
Empty Title Is Rejected With 400
    ${body}=    Create Dictionary    title=${EMPTY}
    ${response}=    POST    ${BASE_URL}/api/tasks    json=${body}    expected_status=400
    Should Contain    ${response.json()}[error]    title
# @tutorial:end c-2-empty-title

# @tutorial:begin c-4-stored
Created Task Is Stored In The Database
    ${body}=    Create Dictionary    title=Robot stored task    priority=${3}
    ${response}=    POST    ${BASE_URL}/api/tasks    json=${body}
    ${id}=    Set Variable    ${response.json()}[id]
    ${rows}=    Query    SELECT title, priority FROM tasks WHERE id = ${id}
    Should Be Equal    ${rows}[0][0]    Robot stored task
    Should Be Equal As Integers    ${rows}[0][1]    3
# @tutorial:end c-4-stored

# @tutorial:begin c-6-done
Marking A Task Done Sets Completed At
    ${body}=    Create Dictionary    title=Robot done task
    ${created}=    POST    ${BASE_URL}/api/tasks    json=${body}
    ${id}=    Set Variable    ${created.json()}[id]
    ${done}=    Create Dictionary    done=${True}
    ${response}=    PATCH    ${BASE_URL}/api/tasks/${id}/done    json=${done}
    Should Be Equal As Integers    ${response.json()}[done]    1
    ${rows}=    Query    SELECT completed_at IS NOT NULL FROM tasks WHERE id = ${id}
    Should Be Equal As Integers    ${rows}[0][0]    1
# @tutorial:end c-6-done
