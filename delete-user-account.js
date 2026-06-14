const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'shashi-app-social-run/backend/.env') });

const mongoose = require('./shashi-app-social-run/backend/node_modules/mongoose');
const User = require('./shashi-app-social-run/backend/models/User');
const Message = require('./shashi-app-social-run/backend/models/Message');
const Notification = require('./shashi-app-social-run/backend/models/Notification');
const Reel = require('./shashi-app-social-run/backend/models/Reel');
const Post = require('./shashi-app-social-run/backend/models/Post');
const Story = require('./shashi-app-social-run/backend/models/Story');
const Group = require('./shashi-app-social-run/backend/models/Group');
const Report = require('./shashi-app-social-run/backend/models/Report');

async function main(){
  const value = process.argv[2];
  if(!value){
    console.log('Usage: node delete-user-account.js email_or_username_or_mobile');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({
    $or: [
      { email: value.toLowerCase() },
      { username: value },
      { phone: value }
    ]
  });

  if(!user){
    console.log('No matching user found.');
    await mongoose.disconnect();
    return;
  }

  const username = user.username;
  await Promise.all([
    User.deleteOne({ _id: user._id }),
    Message.deleteMany({ $or: [{ sender: username }, { receiver: username }] }),
    Notification.deleteMany({ $or: [{ sender: username }, { recipient: username }] }),
    Reel.deleteMany({ username }),
    Post.deleteMany({ username }),
    Story.deleteMany({ username }),
    Group.updateMany({}, { $pull: { admins: username, members: username } }),
    Report.deleteMany({ $or: [{ reporter: username }, { targetUser: username }] }),
    User.updateMany({}, {
      $pull: {
        friends: username,
        followers: username,
        following: username,
        friendRequests: username,
        blockedUsers: username
      }
    })
  ]);

  await mongoose.disconnect();
  console.log(`Deleted account and related data for ${username}.`);
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
