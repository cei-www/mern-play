# @tutorial:begin cp1-ex1-head
*** Settings ***
Library    RequestsLibrary
Library    Collections
# @tutorial:end cp1-ex1-head
# @tutorial:begin cp1-ex2-db
Library    DatabaseLibrary
Suite Setup    Connect To Database    pymysql    db_name=taskapp_test    db_user=robot    db_password=robot_pw    db_host=db    db_port=3306
Suite Teardown    Disconnect From All Databases
# @tutorial:end cp1-ex2-db

# @tutorial:begin cp1-ex1-groups-work
*** Variables ***
${BASE_URL}    http://localhost:3001

*** Test Cases ***
Groups Contain Work
    ${response}=    GET    ${BASE_URL}/api/groups
    Should Be Equal As Integers    ${response.status_code}    200
    ${names}=    Create List
    FOR    ${group}    IN    @{response.json()}
        Append To List    ${names}    ${group}[name]
    END
    Should Contain    ${names}    Work
# @tutorial:end cp1-ex1-groups-work

# @tutorial:begin cp1-ex2-group-name
Empty Group Name Is Rejected And Adds No Row
    ${before}=    Query    SELECT COUNT(*) FROM task_groups
    ${body}=    Create Dictionary    name=${EMPTY}
    ${response}=    POST    ${BASE_URL}/api/groups    json=${body}    expected_status=400
    ${after}=    Query    SELECT COUNT(*) FROM task_groups
    Should Be Equal As Integers    ${after}[0][0]    ${before}[0][0]
# @tutorial:end cp1-ex2-group-name
