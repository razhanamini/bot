####   start

##  buy service
##  my services
##  test config
##  add funds
##  my account 
##  Support
##  How to use


-------------------------------

/start  -> create user with id and username of telegram username inside database
/buy service -> list all the services (fetch the services from database) and return  /user picks a service -> get service details and confirms message -> if confirmed
   -> if confirmed, check user balanace, if enough, create service for user, if now, show the error message of inneficient funds
    -> if purchase successfull returns the links for the created service
/my services -> fetch users services from database
/ test_consfig -> check db if user already has a test config or not, if they had, show message, if not, activate a test service for the user, regardless of funds
/ add_funds -> ask user for how much to add to input -> craete invoice set status, return message to user conatining card number to transfer it to-> give button i payed it, user hits, show message that says send the recipt photo or message, sent, (or cancel oprtation)-> hit i sent the reciept photo, show success, your payment bwill be processed in a few minutes
 -> once recipt sent, send the recipt to backend, store it for that user, send it to the admin account with 2 link choices buttons to confirm or decline,
  if confirmed, backend sets it to payed and update status and balance for user

/my_account -> show users username, id, balance, and number of active services
/support -> show message to text the support pm direct showing the id
/how to use -> redirect to channel where tutorials are


this is a telegram bot project for v2ray configs (subs) sales

i need this implemented via nodejs typescript and postgresql database containerized, talking to the telegeam bots,
notice that, through the payment confirmation process, it needs to send the recipt photos to the admin accounts provided with their ids
and get them 2 buttons to confirm or decline the paymnet,
for now, mock creting the actual services and return a dummy vless link, i will later on implement that,
i need it simple and clean with good structure


##Important notes while debugging

1.
the test services id is specifically set to 1111
and the logic for detecting the test service works by looking for that specific id

2. the test service's expiry time is set to one hour hardcoded into the v2ray.service's createService method
such that if there is a test service being created, its expiry time is set to 1 hour 
regardless of the amount in the database

3. 
if you want to enable the feature that allows you to have separate servers for test accounts,
you could modify the code such that you use the OPTIONAL parameter of the createService method and 
set it to true for test service creation and in the code you use selectOptimalTestServer function
that function uses another method that works with the database which,
the way we specify test servers is such that the servers that have the cpu_cores parameter
in the database set to the specific number of 1111 are trated as test servers

