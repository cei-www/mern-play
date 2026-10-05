# @tutorial:begin d-2-resource
*** Settings ***
Library    RequestsLibrary
Library    DatabaseLibrary
Library    Collections

*** Variables ***
${BASE_URL}    http://localhost:3001
${DB_NAME}     taskapp_test
${DB_USER}     robot
${DB_PASSWORD}    robot_pw
${DB_HOST}     db
# @tutorial:end d-2-resource

# @tutorial:begin d-3-keywords
*** Keywords ***
Connect To Test Database
    Connect To Database    pymysql    db_name=${DB_NAME}    db_user=${DB_USER}    db_password=${DB_PASSWORD}    db_host=${DB_HOST}    db_port=3306

Delete Test Tasks
    Execute Sql String    DELETE FROM tasks WHERE title LIKE 'Robot %'
# @tutorial:end d-3-keywords

# @tutorial:begin d-4-create-task
Create Task
    [Arguments]    ${title}    ${priority}=${2}
    ${body}=    Create Dictionary    title=${title}    priority=${priority}
    ${response}=    POST    ${BASE_URL}/api/tasks    json=${body}
    Should Be Equal As Integers    ${response.status_code}    201
    RETURN    ${response.json()}[id]

Task Should Exist
    [Arguments]    ${id}
    ${rows}=    Query    SELECT COUNT(*) FROM tasks WHERE id = ${id}
    Should Be Equal As Integers    ${rows}[0][0]    1
# @tutorial:end d-4-create-task

# @tutorial:begin d-5-more-keywords
Mark Task Done
    [Arguments]    ${id}
    ${body}=    Create Dictionary    done=${True}
    ${response}=    PATCH    ${BASE_URL}/api/tasks/${id}/done    json=${body}
    Should Be Equal As Integers    ${response.status_code}    200

Completed At Should Be Set
    [Arguments]    ${id}
    ${rows}=    Query    SELECT completed_at IS NOT NULL FROM tasks WHERE id = ${id}
    Should Be Equal As Integers    ${rows}[0][0]    1
# @tutorial:end d-5-more-keywords

# @tutorial:begin cp2-ex3-keyword
Task Count Should Match Database
    ${response}=    GET    ${BASE_URL}/api/tasks
    ${api_count}=    Get Length    ${response.json()}
    ${rows}=    Query    SELECT COUNT(*) FROM tasks
    Should Be Equal As Integers    ${api_count}    ${rows}[0][0]
# @tutorial:end cp2-ex3-keyword
