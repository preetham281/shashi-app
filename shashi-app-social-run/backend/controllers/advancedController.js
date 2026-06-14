const User = require('../models/User');
const Message = require('../models/Message');
const Reel = require('../models/Reel');
const Story = require('../models/Story');
const Group = require('../models/Group');
const Report = require('../models/Report');

function tagsFrom(text){
  const value = String(text || '');
  return {
    hashtags: [...new Set((value.match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()))],
    mentions: [...new Set((value.match(/@[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1)))]
  };
}

function canManageGroup(group, actor){
  return Boolean(actor && group && group.admins.includes(actor));
}

async function groupActor(req){
  const actorUser = await User.findById(req.user.id).select('username');
  return actorUser && actorUser.username;
}

exports.explore = async (req, res) => {
  try {
    const reels = await Reel.find().sort({ createdAt: -1 }).limit(30);
    const users = await User.find().select('username profilePhoto verified bio followers online').sort({ followers: -1, username: 1 }).limit(20);
    const tags = {};

    reels.forEach((reel) => {
      [...(reel.hashtags || []), ...tagsFrom(reel.caption).hashtags].forEach((tag) => {
        tags[tag] = (tags[tag] || 0) + 1;
      });
    });

    res.json({
      reels: reels
        .map((reel) => ({
          ...reel.toObject(),
          score: (reel.likes || []).length * 3 + (reel.comments || []).length * 2
        }))
        .sort((a, b) => b.score - a.score),
      users,
      hashtags: Object.entries(tags)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
    });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.analytics = async (req, res) => {
  try {
    const [users, onlineUsers, messages, reels, stories, groups, reports] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ online: true }),
      Message.countDocuments(),
      Reel.countDocuments(),
      Story.countDocuments(),
      Group.countDocuments(),
      Report.countDocuments({ status: 'open' })
    ]);

    res.json({
      users,
      onlineUsers,
      messages,
      reels,
      stories,
      groups,
      openReports: reports
    });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description, members = [], allowMembersToAdd = false } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    const owner = actor && actor.username;
    if(!name || !owner){
      return res.status(400).json({ message: 'Group name and owner are required' });
    }

    const allMembers = [...new Set([owner, ...members.filter(Boolean)])];
    const group = await Group.create({
      name,
      description,
      owner,
      admins: [owner],
      members: allMembers,
      allowMembersToAdd: Boolean(allowMembersToAdd)
    });

    res.status(201).json(group);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getGroups = async (req, res) => {
  try {
    const username = req.query.username;
    const filter = username ? { members: username } : {};
    const groups = await Group.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json(groups);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.joinGroup = async (req, res) => {
  try {
    const { username } = req.body;
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(!canManageGroup(group, actor) && !(group.allowMembersToAdd && group.members.includes(actor))){
      return res.status(403).json({ message: 'Only admins or permitted members can add people' });
    }
    if(!username){
      return res.status(400).json({ message: 'Username is required' });
    }
    group.members = [...new Set([...group.members, username])];
    await group.save();
    res.json(group);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateGroupDetails = async (req, res) => {
  try {
    const { name, description } = req.body;
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(!canManageGroup(group, actor)){
      return res.status(403).json({ message: 'Only group admins can edit group details' });
    }
    if(name !== undefined){
      const nextName = String(name || '').trim();
      if(!nextName){
        return res.status(400).json({ message: 'Group name is required' });
      }
      group.name = nextName;
    }
    if(description !== undefined){
      group.description = String(description || '').trim();
    }
    await group.save();
    res.json(group);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateGroupSettings = async (req, res) => {
  try {
    const { allowMembersToAdd } = req.body;
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(!canManageGroup(group, actor)){
      return res.status(403).json({ message: 'Only group admins can change permissions' });
    }
    group.allowMembersToAdd = Boolean(allowMembersToAdd);
    await group.save();
    res.json(group);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.makeGroupAdmin = async (req, res) => {
  try {
    const { username } = req.body;
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(!canManageGroup(group, actor)){
      return res.status(403).json({ message: 'Only existing admins can select new admins' });
    }
    if(!group.members.includes(username)){
      return res.status(400).json({ message: 'New admin must already be a group member' });
    }
    group.admins = [...new Set([...group.admins, username])];
    await group.save();
    res.json(group);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeGroupAdmin = async (req, res) => {
  try {
    const username = req.params.username;
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(!canManageGroup(group, actor)){
      return res.status(403).json({ message: 'Only group admins can remove admins' });
    }
    if(username === group.owner){
      return res.status(400).json({ message: 'Group owner cannot be removed from admins' });
    }
    if(group.admins.length <= 1){
      return res.status(400).json({ message: 'Group needs at least one admin' });
    }
    group.admins = group.admins.filter((name) => name !== username);
    await group.save();
    res.json(group);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeGroupMember = async (req, res) => {
  try {
    const username = req.params.username;
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(!canManageGroup(group, actor)){
      return res.status(403).json({ message: 'Only group admins can remove members' });
    }
    if(username === group.owner){
      return res.status(400).json({ message: 'Group owner cannot be removed' });
    }
    group.members = group.members.filter((name) => name !== username);
    group.admins = group.admins.filter((name) => name !== username);
    await group.save();
    res.json(group);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(!group.members.includes(actor)){
      return res.status(400).json({ message: 'You are not in this group' });
    }
    if(actor === group.owner){
      return res.status(400).json({ message: 'Owner must delete the group or make another owner first' });
    }
    group.members = group.members.filter((name) => name !== actor);
    group.admins = group.admins.filter((name) => name !== actor);
    await group.save();
    res.json({ message: 'Left group', group });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const actor = await groupActor(req);
    const group = await Group.findById(req.params.id);
    if(!group){
      return res.status(404).json({ message: 'Group not found' });
    }
    if(group.owner !== actor){
      return res.status(403).json({ message: 'Only the group owner can delete this group' });
    }
    await Message.deleteMany({ receiver: `group:${group._id}` });
    await Group.findByIdAndDelete(group._id);
    res.json({ message: 'Group deleted' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createReport = async (req, res) => {
  try {
    const { targetType, targetId, targetUser, reason } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    const reporter = actor && actor.username;
    if(!reporter || !reason){
      return res.status(400).json({ message: 'Reporter and reason are required' });
    }
    const recentReports = await Report.countDocuments({
      reporter,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });
    if(recentReports >= 10){
      return res.status(429).json({ message: 'Spam protection: too many reports. Try again later.' });
    }
    const report = await Report.create({ reporter, targetType, targetId, targetUser, reason });
    res.status(201).json(report);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const actor = await User.findById(req.user.id).select('username role');
    const reports = await Report.find(actor && actor.role === 'admin' ? {} : { reporter: actor.username }).sort({ createdAt: -1 }).limit(100);
    res.json(reports);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { blockedUser } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    const username = actor && actor.username;
    if(!username || !blockedUser){
      return res.status(400).json({ message: 'Username and blocked user are required' });
    }
    const user = await User.findOneAndUpdate(
      { username },
      { $addToSet: { blockedUsers: blockedUser } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { blockedUser } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    const username = actor && actor.username;
    const user = await User.findOneAndUpdate(
      { username },
      { $pull: { blockedUsers: blockedUser } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifyUser = async (req, res) => {
  try {
    const actor = await User.findById(req.user.id).select('role');
    if(!actor || actor.role !== 'admin'){
      return res.status(403).json({ message: 'Admin access required' });
    }
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { verified: true },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.featureStatus = (req, res) => {
  res.json({
    liveStreaming: 'Prepared. Needs a live video provider before production.',
    wallet: 'Prepared. Needs payment gateway account before production.',
    advancedAi: 'Removed. The app uses built-in local AI helpers.',
    offlineMode: 'Prepared in UI. Full background sync needs service worker/native storage.'
  });
};
