var User = require("../models/User");
var bcrypt = require('bcrypt');
const saltRounds = 10;

exports.getMe = function(req, res, next) {
  if (!req.decoded._id) {
    return next({
      status: 403,
      message: 'Token is valid, but you are not logged in as a user.'
    });
  }
  User.findById(req.decoded._id)
  .deepPopulate('bookmarks bookmarks.creators bookmarks.artists bookmarks.coverImage notes.term')
  .exec(function(err, data) {
    if (err) {
      return next(err);
    }
    return res.json({
      success: true,
      payload: data,
    });
  });
};

exports.getUsers = function(req, res, next) {
  if (!req.decoded._id) {
    return next({
      status: 403,
      message: 'Token is valid, but you are not logged in as a user.'
    });
  }
  if (req.decoded.entry !== 'dash') {
    return next({
      status: 403,
      message: 'Token is valid, but only dashboard entry can get all users.'
    });
  }

  let query = req.query.q || {};

  // Convert roles query from array to object
  if (req.query.roles) {
    // Make sure roles is an array first
    req.query.roles = Array.isArray(req.query.roles) ? req.query.roles : [req.query.roles];
    query.roles = { $in : req.query.roles };
  }

  User.find(query)
  .deepPopulate('bookmarks bookmarks.creators bookmarks.artists notes.term')
  .exec(function(err, data) {
    if (err) {
      return next(err);
    } else {
      return res.json({
        success: true,
        payload: data,
      });
    }
  });
};

exports.getUser = function(req, res, next) {
  User.findById(req.params.id)
  .deepPopulate('bookmarks bookmarks.creators bookmarks.artists bookmarks.coverImage notes.term')
  .exec(function(err, foundUser) {
    if (err) {
      return next(err);
    } else {
      return res.json({
        success: true,
        payload: foundUser,
      });
    }
  });
};

exports.postUser = function(req, res, next) {
  if (!req.body.name || !req.body.roles || !req.body.email) {
    return next({
      status: 400,
      message: "Name, roles, or email fields are missing in post body.",
    });
  }

  // Make sure roles ends up as an array
  const roles = Array.isArray(req.body.roles) ? req.body.roles : [req.body.roles];

  // If entry is app, make sure that one of the roles is `reader`
  if (req.decoded.entry === 'app' && !roles.includes('reader')) {
    roles.push('reader');
  }
  
  // Admins and readers must have a password
  if (roles.includes('admin') || roles.includes('reader')) {
    if (!req.body.password) {
      return next({
        status: 400,
        message: "Admins and readers require a password to be set.",
      });
    }
  }

  // Do not add a new user with duplicate email
  User.findOne({ email: req.body.email }, function(err, foundUser) {
    if (err) {
      return next(err);
    }
    if (foundUser) {
      return next({
        status: 409,
        message: "Cannot add new user. Email already exists.",
      });
    }
    // If body has a password, hash it, then create user with rest of information
    if (req.body.password) {
      return bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        if (err) {
          return next(err);
        }
        const newUser = new User({
          ...req.body,
          roles,
          password: hash,
        });

        newUser.save(function(err, savedUser) {
          if (err) {
            return next(err);
          }
          return res.json({
            success: true,
            payload: {
              _id: savedUser._id,
            },
          });
        });
      });
    }
    // If body does not have a password, create user with rest of information
    const newUser = new User({
      ...req.body,
      roles,
    });

    newUser.save(function(err, savedUser) {
      if (err) {
        return next(err);
      }
      return res.json({ 
        success: true,
        payload: savedUser,
      });
    });
  });
};

exports.putUser = function(req, res, next) {
  User.findById(req.params.id)
  .deepPopulate('bookmarks bookmarks.creators bookmarks.artists bookmarks.coverImage notes.term')
  .exec(function(err, foundUser) {
    if (err) {
      return next(err);
    } else {
      if (!foundUser) {
        return next({
          status: 404,
          message: 'User not found.',
        });
      }
      // If password is being updated, hash the new password
      if (req.body.newPassword) {
        // First check if password matches current password
        // TODO: Repeated work
        bcrypt.compare(req.body.currentPassword, foundUser.password, function(err, isMatch) {
          if (err) {
            return next(err);
          }
          if (!isMatch) {
            return next({
              status: 404,
              message: "Updating password failed. Incorrect current password."
            });
          }
          // Current password matches, so go ahead with hashing the new password
          bcrypt.hash(req.body.newPassword, saltRounds, function(err, hash) {
            if (err) {
              return next(err);
            }
            const updatedUser = {
              ...req.body,
              password: hash,
            };
            foundUser.set(updatedUser);
            foundUser.save(function (err, savedUser) {
              if (err) {
                return next(err);
              } else {
                savedUser.password = undefined;
                return res.json({
                  success: true,
                  payload: savedUser,
                });
              }
            });
          });
        });
      } else {
        const updatedUser = {
          ...req.body,
        };
        foundUser.set(updatedUser);
        foundUser.save(function (err, savedUser) {
          if (err) {
            return next(err);
          }
          savedUser.password = undefined;
          return res.json({
            success: true,
            payload: savedUser,
          });
        });
      }
    }
  }).select("+password");
};

exports.deleteUser = function(req, res, next) {
  User.findByIdAndRemove(req.params.id, function(err, deletedUser) {
    if (err) {
      return next(err);
    } else {
      return res.json({
        success: true,
        payload: deletedUser,
      });
    }
  });
};
