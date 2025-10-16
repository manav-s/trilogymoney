-- Replace +13477224114 with your actual phone number
DELETE FROM "Message" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "phone" = '+13477224114');
DELETE FROM "PlaidAccount" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "phone" = '+13477224114');
DELETE FROM "User" WHERE "phone" = '+13477224114';
DELETE FROM "MagicLink" WHERE "phone" = '+13477224114';
